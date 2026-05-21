import { macroTimeline, marketAssets, sectorHeat } from "../data/mockData.js";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FRANKFURTER_LATEST_URL = "https://api.frankfurter.dev/v1/latest";
const FRANKFURTER_HISTORICAL_URL = "https://api.frankfurter.dev/v1";
const OPEN_EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/USD";

const liveMarketProxies = [
  {
    symbol: "SPX",
    proxySymbol: "SPY",
    note: "Live Finnhub quote using SPY ETF as the S&P 500 proxy.",
  },
  {
    symbol: "NDX",
    proxySymbol: "QQQ",
    note: "Live Finnhub quote using QQQ ETF as the Nasdaq proxy.",
  },
  {
    symbol: "XAU",
    proxySymbol: "GLD",
    note: "Live Finnhub quote using GLD ETF as the gold proxy.",
  },
  {
    symbol: "WTI",
    proxySymbol: "USO",
    note: "Live Finnhub quote using USO ETF as the oil proxy.",
  },
];

export async function getMarkets() {
  const fallback = getFallbackMarketsData();
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  const assets = await buildLiveMarketAssets(fallback.assets, apiKey);
  const liveRequiredAssets = assets.filter((asset) => isRequiredLiveAsset(asset.symbol) && asset.fallback === false);
  const missingRequiredSymbols = liveMarketProxies
    .map((proxy) => proxy.symbol)
    .filter((symbol) => !liveRequiredAssets.some((asset) => asset.symbol === symbol));
  const marketProxiesLive = Boolean(apiKey) && liveRequiredAssets.length > 0 && missingRequiredSymbols.length === 0;
  const usdInrAsset = assets.find((asset) => asset.symbol === "USDINR");
  const errors = [
    ...(!apiKey ? ["FINNHUB_API_KEY is not configured."] : []),
    ...(apiKey && liveRequiredAssets.length === 0 ? ["Finnhub did not return usable market proxy quotes."] : []),
    ...(apiKey && missingRequiredSymbols.length ? [`Finnhub missing proxy data for ${missingRequiredSymbols.join(", ")}.`] : []),
    ...(usdInrAsset?.fallback ? ["USD/INR live FX sources unavailable."] : []),
  ];

  return {
    data: {
      assets,
      quotes: assets.map(toQuote),
      sectorHeat,
      macroTimeline,
    },
    meta: {
      ...(errors.length ? { error: errors.join(" ") } : {}),
      fallback: !marketProxiesLive,
      source: marketProxiesLive ? "finnhub" : "mock",
    },
  };
}

export async function getCrypto() {
  return {
    assets: marketAssets.filter((asset) => asset.category === "Crypto").map(withMockSource),
  };
}

function toQuote(asset) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    price: Number(asset.value.replace(/[$,]/g, "")),
    changePercent: asset.change,
    trend: asset.change > 0.05 ? "up" : asset.change < -0.05 ? "down" : "flat",
    category: asset.category,
    fallback: asset.fallback ?? true,
    source: asset.source ?? "mock",
  };
}

function getFallbackMarketsData() {
  const assets = marketAssets.map(withMockSource);

  return {
    assets,
    quotes: assets.map(toQuote),
    sectorHeat,
    macroTimeline,
  };
}

async function buildLiveMarketAssets(fallbackAssets, apiKey) {
  const usdInrFallback = fallbackAssets.find((asset) => asset.symbol === "USDINR");
  const [proxyResults, usdInrAsset] = await Promise.all([
    apiKey
      ? Promise.allSettled(
          liveMarketProxies.map(async (proxy) => ({
            proxy,
            quote: await fetchFinnhubQuote(proxy.proxySymbol, apiKey),
          })),
        )
      : Promise.resolve([]),
    usdInrFallback ? buildLiveUsdInrAsset(usdInrFallback).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const liveBySymbol = new Map();

  for (const result of proxyResults) {
    if (result.status !== "fulfilled") continue;

    const { proxy, quote } = result.value;
    const fallbackAsset = fallbackAssets.find((asset) => asset.symbol === proxy.symbol);
    if (!fallbackAsset) continue;

    liveBySymbol.set(proxy.symbol, toLiveAsset(fallbackAsset, proxy, quote));
  }

  if (usdInrAsset) {
    liveBySymbol.set("USDINR", usdInrAsset);
  }

  return fallbackAssets.map((asset) => liveBySymbol.get(asset.symbol) ?? withMockSource(asset));
}

async function buildLiveUsdInrAsset(fallbackAsset) {
  const quote = await fetchUsdInrQuote();
  const change = quote.previousRate ? Number((((quote.rate - quote.previousRate) / quote.previousRate) * 100).toFixed(2)) : 0;

  return {
    ...fallbackAsset,
    change,
    fallback: false,
    lastUpdatedAt: quote.updatedAt,
    note: "Live FX quote for USD/INR.",
    series: scaleSeriesToPrice(fallbackAsset.series, quote.rate),
    source: quote.source,
    value: formatMarketValue(quote.rate, fallbackAsset.category),
  };
}

async function fetchUsdInrQuote() {
  try {
    return await fetchFrankfurterUsdInrQuote();
  } catch {
    return fetchOpenExchangeUsdInrQuote();
  }
}

async function fetchFrankfurterUsdInrQuote() {
  const latestUrl = new URL(FRANKFURTER_LATEST_URL);
  latestUrl.searchParams.set("from", "USD");
  latestUrl.searchParams.set("to", "INR");

  const latest = await fetchJson(latestUrl, "Frankfurter");
  const rate = Number(latest?.rates?.INR);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Frankfurter response missing USD/INR rate.");
  }

  const previousRate = latest?.date ? await fetchFrankfurterPreviousUsdInrRate(latest.date).catch(() => undefined) : undefined;

  return {
    rate,
    previousRate,
    source: "Frankfurter:USDINR",
    updatedAt: latest?.date ? new Date(`${latest.date}T00:00:00Z`).toISOString() : new Date().toISOString(),
  };
}

async function fetchFrankfurterPreviousUsdInrRate(latestDate) {
  const previousDate = getPreviousDate(latestDate);
  const historicalUrl = new URL(`${FRANKFURTER_HISTORICAL_URL}/${previousDate}`);
  historicalUrl.searchParams.set("from", "USD");
  historicalUrl.searchParams.set("to", "INR");

  const previous = await fetchJson(historicalUrl, "Frankfurter historical");
  const previousRate = Number(previous?.rates?.INR);

  return Number.isFinite(previousRate) && previousRate > 0 ? previousRate : undefined;
}

async function fetchOpenExchangeUsdInrQuote() {
  const payload = await fetchJson(OPEN_EXCHANGE_RATE_URL, "Open Exchange Rates");
  const rate = Number(payload?.rates?.INR);

  if (payload?.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Open exchange-rate response missing USD/INR rate.");
  }

  return {
    rate,
    previousRate: undefined,
    source: "ExchangeRate-API:USDINR",
    updatedAt: payload?.time_last_update_utc ? new Date(payload.time_last_update_utc).toISOString() : new Date().toISOString(),
  };
}

async function fetchJson(url, sourceName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "NEXUS-Intel/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${sourceName} responded with ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFinnhubQuote(symbol, apiKey) {
  const url = new URL(FINNHUB_QUOTE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "NEXUS-Intel/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Finnhub responded with ${response.status}`);
    }

    const quote = await response.json();

    if (!isUsableQuote(quote)) {
      throw new Error(`Finnhub response missing quote data for ${symbol}.`);
    }

    return quote;
  } finally {
    clearTimeout(timeout);
  }
}

function toLiveAsset(fallbackAsset, proxy, quote) {
  const change = getChangePercent(quote);
  const price = Number(quote.c);

  return {
    ...fallbackAsset,
    change,
    fallback: false,
    lastUpdatedAt: Number.isFinite(quote.t) && quote.t > 0 ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
    note: proxy.note,
    proxySymbol: proxy.proxySymbol,
    series: scaleSeriesToPrice(fallbackAsset.series, price),
    source: `Finnhub:${proxy.proxySymbol}`,
    value: formatMarketValue(price, fallbackAsset.category),
  };
}

function withMockSource(asset) {
  return {
    ...asset,
    fallback: true,
    source: "mock",
  };
}

function isRequiredLiveAsset(symbol) {
  return liveMarketProxies.some((proxy) => proxy.symbol === symbol);
}

function isUsableQuote(quote) {
  return quote && Number.isFinite(quote.c) && quote.c > 0;
}

function getChangePercent(quote) {
  if (Number.isFinite(quote.dp)) return Number(quote.dp);
  if (Number.isFinite(quote.c) && Number.isFinite(quote.pc) && quote.pc > 0) {
    return Number((((quote.c - quote.pc) / quote.pc) * 100).toFixed(2));
  }

  return 0;
}

function getPreviousDate(date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function scaleSeriesToPrice(series, price) {
  const previousLast = series.at(-1)?.value;
  const scale = previousLast ? price / previousLast : 1;

  return series.map((point) => ({
    ...point,
    value: Number((point.value * scale).toFixed(2)),
  }));
}

function formatMarketValue(value, category) {
  if (category === "FX") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}
