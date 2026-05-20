import { macroTimeline, marketAssets, sectorHeat } from "../data/mockData.js";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";

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

const optionalMarketProxies = [
  {
    symbol: "USDINR",
    proxySymbol: "OANDA:USD_INR",
    note: "Live Finnhub forex quote using OANDA USD/INR.",
  },
];

export async function getMarkets() {
  const fallback = getFallbackMarketsData();
  const apiKey = process.env.FINNHUB_API_KEY?.trim();

  if (!apiKey) {
    return buildFallbackEnvelope("FINNHUB_API_KEY is not configured.");
  }

  const assets = await buildFinnhubAssets(fallback.assets, apiKey);
  const liveRequiredAssets = assets.filter((asset) => isRequiredLiveAsset(asset.symbol) && asset.fallback === false);

  if (liveRequiredAssets.length === 0) {
    return buildFallbackEnvelope("Finnhub did not return usable market proxy quotes.");
  }

  const missingRequiredSymbols = liveMarketProxies
    .map((proxy) => proxy.symbol)
    .filter((symbol) => !liveRequiredAssets.some((asset) => asset.symbol === symbol));

  return {
    data: {
      assets,
      quotes: assets.map(toQuote),
      sectorHeat,
      macroTimeline,
    },
    meta: {
      ...(missingRequiredSymbols.length
        ? { error: `Finnhub missing proxy data for ${missingRequiredSymbols.join(", ")}.` }
        : {}),
      fallback: missingRequiredSymbols.length > 0,
      source: "finnhub",
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

function buildFallbackEnvelope(error) {
  return {
    data: getFallbackMarketsData(),
    meta: {
      error,
      fallback: true,
      source: "mock",
    },
  };
}

async function buildFinnhubAssets(fallbackAssets, apiKey) {
  const proxyResults = await Promise.allSettled(
    [...liveMarketProxies, ...optionalMarketProxies].map(async (proxy) => ({
      proxy,
      quote: await fetchFinnhubQuote(proxy.proxySymbol, apiKey),
    })),
  );
  const liveBySymbol = new Map();

  for (const result of proxyResults) {
    if (result.status !== "fulfilled") continue;

    const { proxy, quote } = result.value;
    const fallbackAsset = fallbackAssets.find((asset) => asset.symbol === proxy.symbol);
    if (!fallbackAsset) continue;

    liveBySymbol.set(proxy.symbol, toLiveAsset(fallbackAsset, proxy, quote));
  }

  return fallbackAssets.map((asset) => liveBySymbol.get(asset.symbol) ?? withMockSource(asset));
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
