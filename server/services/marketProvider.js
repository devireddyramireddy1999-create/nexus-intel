import { macroTimeline, marketAssets, sectorHeat } from "../data/mockData.js";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_CANDLE_URL = "https://finnhub.io/api/v1/stock/candle";
const FRANKFURTER_LATEST_URL = "https://api.frankfurter.dev/v1/latest";
const FRANKFURTER_HISTORICAL_URL = "https://api.frankfurter.dev/v1";
const OPEN_EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/USD";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const liveMarketProxies = [
  {
    symbol: "SPX",
    proxySymbol: "SPY",
    historySymbol: "SPY",
    note: "SPX Proxy uses SPY ETF.",
  },
  {
    symbol: "NDX",
    proxySymbol: "QQQ",
    historySymbol: "QQQ",
    note: "NDX Proxy uses QQQ ETF.",
  },
  {
    symbol: "XAU",
    proxySymbol: "GLD",
    historySymbol: "GLD",
    note: "Gold Proxy uses GLD ETF.",
  },
  {
    symbol: "WTI",
    proxySymbol: "USO",
    historySymbol: "USO",
    note: "Oil Proxy uses USO ETF.",
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

  logFinalMarketResponse(assets);

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
            chart: await fetchMarketProxyChart(proxy, apiKey),
          })),
        )
      : Promise.resolve([]),
    usdInrFallback ? buildLiveUsdInrAsset(usdInrFallback).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const liveBySymbol = new Map();

  for (const result of proxyResults) {
    if (result.status !== "fulfilled") continue;

    const { proxy, quote, chart } = result.value;
    const fallbackAsset = fallbackAssets.find((asset) => asset.symbol === proxy.symbol);
    if (!fallbackAsset) continue;

    liveBySymbol.set(proxy.symbol, toLiveAsset(fallbackAsset, proxy, quote, chart));
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
    note: quote.series?.length ? "Live FX quote. Chart uses FX historical series." : "Live FX quote for USD/INR. Chart unavailable — latest quote only.",
    series: quote.series ?? [],
    seriesSource: quote.series?.length ? quote.seriesSource : "latest-quote-only",
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
  const series = latest?.date ? await fetchFrankfurterUsdInrSeries(latest.date).catch(() => []) : [];

  return {
    rate,
    previousRate,
    series,
    seriesSource: series.length ? "Frankfurter historical range" : "latest-quote-only",
    source: "Frankfurter:USDINR",
    updatedAt: latest?.date ? new Date(`${latest.date}T00:00:00Z`).toISOString() : new Date().toISOString(),
  };
}

async function fetchFrankfurterUsdInrSeries(latestDate) {
  const startDate = getOffsetDate(latestDate, -14);
  const historicalUrl = new URL(`${FRANKFURTER_HISTORICAL_URL}/${startDate}..${latestDate}`);
  historicalUrl.searchParams.set("from", "USD");
  historicalUrl.searchParams.set("to", "INR");

  const payload = await fetchJson(historicalUrl, "Frankfurter historical range");
  const entries = Object.entries(payload?.rates ?? {})
    .map(([date, rates]) => ({
      time: date.slice(5),
      value: Number(rates?.INR),
    }))
    .filter((point) => Number.isFinite(point.value) && point.value > 0)
    .sort((a, b) => a.time.localeCompare(b.time));

  return entries.length >= 2 ? entries.map((point) => ({ ...point, value: Number(point.value.toFixed(4)) })) : [];
}

async function fetchFrankfurterPreviousUsdInrRate(latestDate) {
  const previousDate = getOffsetDate(latestDate, -1);
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
    series: [],
    seriesSource: "latest-quote-only",
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

async function fetchFinnhubCandles(symbol, apiKey) {
  const url = new URL(FINNHUB_CANDLE_URL);
  const to = Math.floor(Date.now() / 1000);
  const from = to - 7 * 24 * 60 * 60;
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", "60");
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("token", apiKey);

  const diagnostics = {
    provider: "Finnhub stock/candle",
    requestUrl: sanitizeHistoryUrl(url),
    symbol,
  };
  const payload = await fetchHistoryJson(url, `Finnhub candles ${symbol}`, diagnostics);
  if (payload?.s !== "ok" || !Array.isArray(payload.c) || !Array.isArray(payload.t)) {
    const error = `Finnhub response missing candle data for ${symbol}. status=${payload?.s ?? "missing"}`;
    logHistoryDiagnostics({ ...diagnostics, error, points: 0 });
    throw new Error(error);
  }

  const series = payload.c
    .map((close, index) => ({
      time: formatCandleTime(payload.t[index]),
      value: Number(close),
    }))
    .filter((point) => point.time && Number.isFinite(point.value) && point.value > 0);

  const normalized = series.length >= 2 ? series.map((point) => ({ ...point, value: Number(point.value.toFixed(2)) })) : [];
  logHistoryDiagnostics({ ...diagnostics, points: normalized.length });

  return normalized;
}

async function fetchMarketProxyChart(proxy, apiKey) {
  try {
    const series = await fetchFinnhubCandles(proxy.proxySymbol, apiKey);

    if (series.length >= 2) {
      return {
        note: `Chart uses Finnhub hourly candles for ${proxy.proxySymbol} ETF.`,
        series,
        seriesSource: `Finnhub stock/candle:${proxy.proxySymbol}`,
      };
    }
  } catch {
    // Fall back to a no-key daily chart endpoint when Finnhub candles are unavailable.
  }

  try {
    const series = await fetchYahooDailySeries(proxy);

    if (series.length >= 2) {
      return {
        note: `Chart uses Yahoo Finance history for ${proxy.proxySymbol} ETF.`,
        series,
        seriesSource: `Yahoo Finance chart:${proxy.historySymbol}`,
      };
    }
  } catch (error) {
    console.warn(`ETF chart history unavailable for ${proxy.proxySymbol}:`, getErrorMessage(error, "History request failed."));
  }

  return getUnavailableChart();
}

async function fetchYahooDailySeries(proxy) {
  const url = new URL(`${YAHOO_CHART_URL}/${proxy.historySymbol}`);
  url.searchParams.set("range", "1mo");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includePrePost", "false");

  const diagnostics = {
    provider: "Yahoo Finance chart",
    requestUrl: sanitizeHistoryUrl(url),
    symbol: proxy.proxySymbol,
  };
  const payload = await fetchHistoryJson(url, `Yahoo Finance chart ${proxy.proxySymbol}`, diagnostics);
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    const error = `Yahoo Finance response missing chart data for ${proxy.proxySymbol}.`;
    logHistoryDiagnostics({ ...diagnostics, error, points: 0 });
    throw new Error(error);
  }

  const series = timestamps
    .map((timestamp, index) => ({
      time: formatYahooDate(timestamp),
      value: Number(closes[index]),
    }))
    .filter((point) => point.time && Number.isFinite(point.value) && point.value > 0)
    .map((point) => ({ ...point, value: Number(point.value.toFixed(2)) }));

  if (series.length < 2) {
    const error = `Yahoo Finance did not return enough daily history for ${proxy.proxySymbol}.`;
    logHistoryDiagnostics({ ...diagnostics, error, points: series.length });
    throw new Error(error);
  }

  logHistoryDiagnostics({ ...diagnostics, points: series.length });

  return series;
}

async function fetchHistoryJson(url, sourceName, diagnostics) {
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
      const error = `${sourceName} responded with ${response.status}`;
      logHistoryDiagnostics({ ...diagnostics, error, points: 0, status: response.status });
      throw new Error(error);
    }

    diagnostics.status = response.status;
    return response.json();
  } catch (error) {
    if (error instanceof Error && !error.message.includes("responded with")) {
      logHistoryDiagnostics({ ...diagnostics, error: error.message, points: 0 });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toLiveAsset(fallbackAsset, proxy, quote, chart = getUnavailableChart()) {
  const change = getChangePercent(quote);
  const price = Number(quote.c);
  const hasSeries = chart.series.length >= 2;

  return {
    ...fallbackAsset,
    change,
    fallback: false,
    lastUpdatedAt: Number.isFinite(quote.t) && quote.t > 0 ? new Date(quote.t * 1000).toISOString() : new Date().toISOString(),
    note: `${proxy.note} ${hasSeries ? chart.note : "Chart unavailable — latest quote only."}`,
    proxySymbol: proxy.proxySymbol,
    series: hasSeries ? chart.series : [],
    seriesSource: hasSeries ? chart.seriesSource : "latest-quote-only",
    source: `Finnhub:${proxy.proxySymbol}`,
    value: formatMarketValue(price, fallbackAsset.category),
  };
}

function withMockSource(asset) {
  return {
    ...asset,
    fallback: true,
    note: asset.note.includes("latest quote only") || asset.note.includes("Latest quote only")
      ? asset.note
      : `${asset.note} Chart unavailable — latest quote only.`,
    series: [],
    seriesSource: "latest-quote-only",
    source: "mock",
  };
}

function getUnavailableChart() {
  return {
    note: "Chart unavailable — latest quote only.",
    series: [],
    seriesSource: "latest-quote-only",
  };
}

function sanitizeHistoryUrl(url) {
  const safeUrl = new URL(url.toString());
  safeUrl.searchParams.delete("token");
  return safeUrl.toString();
}

function logHistoryDiagnostics({ error, points, provider, requestUrl, status = "ok", symbol }) {
  console.info(
    `[market-history] ${symbol} ${provider} status=${status} points=${points} url=${requestUrl}${error ? ` error="${error}"` : ""}`,
  );
}

function logFinalMarketResponse(assets) {
  for (const proxy of liveMarketProxies) {
    const asset = assets.find((item) => item.symbol === proxy.symbol);
    console.info(
      `[market-response] ${proxy.symbol}/${proxy.proxySymbol} source=${asset?.source ?? "missing"} seriesSource=${asset?.seriesSource ?? "missing"} points=${asset?.series?.length ?? 0} fallback=${asset?.fallback ?? "missing"}`,
    );
  }
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

function getOffsetDate(date, offsetDays) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + offsetDays);
  return parsed.toISOString().slice(0, 10);
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

function formatCandleTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "";

  return new Date(timestamp * 1000).toLocaleString("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function formatYahooDate(timestamp) {
  if (!Number.isFinite(timestamp)) return "";

  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}
