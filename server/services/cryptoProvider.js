import { cryptoRadar } from "../data/mockData.js";
import { getCrypto } from "./marketProvider.js";

const COINGECKO_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
const COINGECKO_MARKET_CHART_URL = "https://api.coingecko.com/api/v3/coins";
const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices";
const COINGECKO_MARKET_CHART_RETRY_DELAY_MS = 800;
const WARNING_THROTTLE_MS = 60_000;
const DEBUG_MARKET = process.env.DEBUG_MARKET === "true";

const coinMap = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
];

const lastSuccessfulMarketCharts = new Map();
const lastSuccessfulCoinGeckoStats = new Map();
const warningTimestamps = new Map();

export async function getCryptoData() {
  try {
    const marketCharts = await fetchCoinGeckoMarketCharts();
    const coinGeckoPrices = await fetchCoinGeckoPrices().catch((error) => {
      logCryptoDebug(
        "CoinGecko simple price failed; deriving crypto prices from market_chart:",
        getErrorMessage(error, "CoinGecko simple price failed."),
      );
      return buildCoinGeckoPricesFromMarketCharts(marketCharts);
    });
    const livePrices = await buildCryptoPriceMap(coinGeckoPrices, marketCharts);
    const crypto = await buildLiveCryptoData(livePrices, marketCharts);
    const providers = new Set(Object.values(livePrices).map((price) => price.provider));
    const hasCoinbaseFallback = providers.has("coinbase");
    const responseSource = providers.size === 1 && providers.has("coinbase") ? "coinbase" : "coingecko";
    logFinalCryptoResponse(crypto.assets, responseSource);

    return {
      data: crypto,
      meta: {
        ...(hasCoinbaseFallback ? { cacheable: false } : {}),
        fallback: false,
        source: responseSource,
      },
    };
  } catch (cryptoError) {
    warnCryptoProviderFailure(
      "crypto",
      "Crypto provider failed:",
      getErrorMessage(cryptoError, "Crypto request failed."),
    );
    const crypto = await getFallbackCryptoData();

    return {
      data: crypto,
      meta: {
        error: getErrorMessage(cryptoError, "Crypto request failed."),
        fallback: true,
        source: "mock",
      },
    };
  }
}

async function fetchCoinGeckoMarketCharts() {
  const results = await Promise.allSettled(
    coinMap.map((coin) => fetchCoinGeckoMarketChartWithRetry(coin)),
  );

  const marketCharts = {};

  for (const [index, result] of results.entries()) {
    const coin = coinMap[index];
    if (result.status === "fulfilled") {
      marketCharts[coin.id] = result.value;
      logCryptoDebug(
        `[crypto-history] ${coin.symbol} CoinGecko market_chart points=${result.value.series.length} cached=${result.value.cached}`,
      );
      continue;
    }

    const message = getErrorMessage(result.reason, "market_chart request failed");
    marketCharts[coin.id] = {
      cached: false,
      error: message,
      series: [],
    };
    warnCryptoProviderFailure(
      `coingecko-chart:${coin.symbol}`,
      `CoinGecko ${coin.symbol} market_chart failed after retry with no cached chart:`,
      message,
    );
  }

  return marketCharts;
}

async function fetchCoinGeckoMarketChartWithRetry(coin) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const series = await fetchCoinGeckoMarketChart(coin.id);
      if (series.length < 2) {
        throw new Error(`CoinGecko market_chart returned ${series.length} points for ${coin.symbol}.`);
      }

      lastSuccessfulMarketCharts.set(coin.id, {
        savedAt: Date.now(),
        series,
      });

      return {
        cached: false,
        series,
      };
    } catch (error) {
      lastError = error;
      logCryptoDebug(
        `[crypto-history] ${coin.symbol} CoinGecko market_chart attempt=${attempt} failed: ${getErrorMessage(error, "market_chart request failed")}`,
      );

      if (attempt === 1) {
        await delay(COINGECKO_MARKET_CHART_RETRY_DELAY_MS);
      }
    }
  }

  const cached = lastSuccessfulMarketCharts.get(coin.id);
  if (cached?.series?.length >= 2) {
    logCryptoDebug(
      `[crypto-history] ${coin.symbol} using cached CoinGecko market_chart points=${cached.series.length} cachedAt=${new Date(cached.savedAt).toISOString()}`,
    );
    return {
      cached: true,
      series: cached.series,
    };
  }

  throw new Error(
    `${coin.symbol} CoinGecko market_chart failed after retry: ${getErrorMessage(lastError, "market_chart request failed")}`,
  );
}

async function fetchCoinGeckoMarketChart(coinId) {
  const url = new URL(`${COINGECKO_MARKET_CHART_URL}/${coinId}/market_chart`);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("days", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "NEXUS-Intel/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CoinGecko market_chart responded with ${response.status} for ${coinId}`);
    }

    const payload = await response.json();
    const series = (payload?.prices ?? [])
      .map(([timestamp, price]) => ({
        time: formatChartTime(timestamp),
        value: Number(price),
      }))
      .filter((point) => point.time && Number.isFinite(point.value) && point.value > 0);

    return series.length >= 2 ? series.map((point) => ({ ...point, value: Number(point.value.toFixed(2)) })) : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCoinGeckoPrices() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(COINGECKO_SIMPLE_PRICE_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "NEXUS-Intel/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CoinGecko responded with ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildCoinGeckoPricesFromMarketCharts(marketCharts) {
  return Object.fromEntries(
    coinMap.flatMap((coin) => {
      const chart = marketCharts[coin.id];
      const series = chart?.series ?? [];
      const first = series[0]?.value;
      const last = series.at(-1)?.value;

      if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) {
        return [];
      }

      const change = ((last - first) / first) * 100;
      const priceData = {
        changeAvailable: true,
        changeSource: chart.cached ? "coingecko_cached_market_chart_24h" : "coingecko_market_chart_24h",
        priceSource: chart.cached ? "coingecko_cached_market_chart" : "coingecko_market_chart",
        provider: "coingecko",
        usd: last,
        usd_24h_change: change,
        usd_last_updated_at: Math.round(Date.now() / 1000),
      };
      cacheCoinGeckoStats(coin.id, priceData);

      return [[coin.id, priceData]];
    }),
  );
}

async function buildCryptoPriceMap(coinGeckoPrices, marketCharts) {
  const entries = await Promise.all(
    coinMap.map(async (coin) => {
      const chart = marketCharts[coin.id];
      const hasChart = chart?.series?.length >= 2;
      const coinGeckoPrice = buildCoinGeckoPriceData(coinGeckoPrices?.[coin.id], chart);
      if (coinGeckoPrice) {
        cacheCoinGeckoStats(coin.id, coinGeckoPrice);
      }

      if (hasChart && coinGeckoPrice) {
        return [coin.id, coinGeckoPrice];
      }

      const cachedStats = lastSuccessfulCoinGeckoStats.get(coin.id);
      if (hasChart && cachedStats) {
        return [
          coin.id,
          {
            ...cachedStats,
            changeSource: chart.cached ? "coingecko_cached_market_chart_24h" : cachedStats.changeSource,
            provider: "coingecko",
          },
        ];
      }

      try {
        return [coin.id, await fetchCoinbasePrice(coin)];
      } catch (coinbaseError) {
        warnCryptoProviderFailure(
          `coinbase:${coin.symbol}`,
          `Coinbase ${coin.symbol} spot fallback failed:`,
          getErrorMessage(coinbaseError, "Coinbase request failed."),
        );

        if (coinGeckoPrice) {
          return [coin.id, coinGeckoPrice];
        }

        throw coinbaseError;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function buildCoinGeckoPriceData(priceData, chart) {
  const usd = Number(priceData?.usd);
  const rawChange = Number(priceData?.usd_24h_change);
  const chartChange = getChartChange(chart);
  const existingChangeSource = priceData?.changeSource;
  const hasLivePrice = Number.isFinite(usd) && usd > 0;
  const hasLiveChange = Number.isFinite(rawChange);
  const hasChartChange = Number.isFinite(chartChange);

  if (hasLivePrice) {
    return {
      changeAvailable: hasLiveChange || hasChartChange,
      changeSource: hasLiveChange
        ? existingChangeSource ?? "coingecko_24h"
        : hasChartChange
          ? chart.cached
            ? "coingecko_cached_market_chart_24h"
            : "coingecko_market_chart_24h"
          : "unavailable",
      priceSource: priceData?.priceSource ?? "coingecko_simple_price",
      provider: "coingecko",
      usd,
      ...(hasLiveChange || hasChartChange ? { usd_24h_change: hasLiveChange ? rawChange : chartChange } : {}),
      usd_last_updated_at: Number(priceData?.usd_last_updated_at) || Math.round(Date.now() / 1000),
    };
  }

  const series = chart?.series ?? [];
  const first = series[0]?.value;
  const last = series.at(-1)?.value;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) {
    return undefined;
  }

  return {
    changeAvailable: true,
    changeSource: chart.cached ? "coingecko_cached_market_chart_24h" : "coingecko_market_chart_24h",
    priceSource: chart.cached ? "coingecko_cached_market_chart" : "coingecko_market_chart",
    provider: "coingecko",
    usd: last,
    usd_24h_change: ((last - first) / first) * 100,
    usd_last_updated_at: Math.round(Date.now() / 1000),
  };
}

async function fetchCoinbasePrice(coin) {
  const payload = await fetchCoinbaseSpotPrice(coin.symbol);
  const price = Number(payload?.data?.amount);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Coinbase response missing ${coin.symbol} price.`);
  }

  return {
    changeAvailable: false,
    changeSource: "unavailable",
    priceSource: "coinbase_spot",
    provider: "coinbase",
    usd: price,
    usd_last_updated_at: Math.round(Date.now() / 1000),
  };
}

async function fetchCoinbaseSpotPrice(symbol) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${COINBASE_SPOT_URL}/${symbol}-USD/spot`, {
      headers: {
        accept: "application/json",
        "user-agent": "NEXUS-Intel/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Coinbase responded with ${response.status} for ${symbol}.`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function buildLiveCryptoData(livePrices, marketCharts = {}) {
  const fallback = await getCrypto();
  const liveAssets = fallback.assets.map((asset) => {
    const coin = coinMap.find((item) => item.symbol === asset.symbol);
    const priceData = coin ? livePrices[coin.id] : undefined;
    const provider = priceData?.provider ?? "coingecko";
    const chart = coin ? marketCharts[coin.id] : undefined;
    const series = chart?.series ?? [];
    const hasSeries = series.length >= 2;

    if (!priceData?.usd) {
      throw new Error(`Crypto response missing ${asset.symbol} price.`);
    }

    const rawChange = Number(priceData.usd_24h_change);
    const changeAvailable = typeof priceData.changeAvailable === "boolean" ? priceData.changeAvailable : Number.isFinite(rawChange);
    const change = changeAvailable ? rawChange : 0;
    const trend = changeAvailable ? getTrend(change) : "flat";

    return {
      ...asset,
      change,
      changeAvailable,
      changeSource: changeAvailable ? (priceData.changeSource ?? getProviderChangeSource(provider)) : "unavailable",
      fallback: false,
      lastUpdatedAt: priceData.usd_last_updated_at
        ? new Date(priceData.usd_last_updated_at * 1000).toISOString()
        : new Date().toISOString(),
      note: getProviderNote(provider, trend, changeAvailable, hasSeries, chart?.cached, priceData.priceSource),
      series: hasSeries ? series : [],
      seriesSource: hasSeries ? getCryptoSeriesSource(coin, chart) : "latest-quote-only",
      source: getProviderLabel(provider),
      trend,
      value: formatUsd(priceData.usd),
    };
  });

  return {
    assets: liveAssets,
    quotes: liveAssets.map(toQuote),
    radar: buildLiveRadar(liveAssets),
  };
}

async function getFallbackCryptoData() {
  const crypto = await getCrypto();
  const assets = crypto.assets.map((asset) => ({
    ...asset,
    note: asset.note.includes("Latest quote only") ? asset.note : `${asset.note} Latest quote only; live chart history unavailable.`,
    series: [],
    seriesSource: "latest-quote-only",
  }));

  return {
    assets,
    quotes: assets.map(toQuote),
    radar: cryptoRadar,
  };
}

function buildLiveRadar(assets) {
  const fallbackBySymbol = new Map(cryptoRadar.map((item) => [item.asset, item]));

  return assets.map((asset) => {
    const fallback = fallbackBySymbol.get(asset.symbol);
    const providerLabel = asset.source ?? "CoinGecko";
    const direction = asset.trend === "up" ? "positive" : asset.trend === "down" ? "negative" : "flat";

    return {
      asset: asset.symbol,
      flow: asset.changeAvailable === false
        ? `Live ${providerLabel} spot fallback is available; 24h change is unavailable from this feed.`
        : `Live ${providerLabel} 24h change is ${formatSigned(asset.change)} with ${direction} price action.`,
      risk: fallback?.risk ?? "Macro liquidity and broad risk appetite remain the main swing factors.",
      score: fallback?.score ?? 70,
      thesis: fallback?.thesis ?? `${asset.name} trend is ${asset.trend} over the last 24 hours.`,
    };
  });
}

function getProviderLabel(provider) {
  return provider === "coinbase" ? "Coinbase" : "CoinGecko";
}

function getProviderNote(provider, trend, changeAvailable, hasSeries, chartCached = false, priceSource = "") {
  if (provider === "coinbase") {
    return "Live Coinbase spot quote. Chart unavailable.";
  }

  if (!changeAvailable) {
    return hasSeries
      ? "Live CoinGecko market history."
      : "Live CoinGecko quote. Chart unavailable.";
  }

  if (chartCached && priceSource === "coingecko_cached_market_chart") {
    return "Recent CoinGecko market history. Last live sync retained.";
  }

  if (chartCached) {
    return "Recent CoinGecko market history. Last live sync retained.";
  }

  return hasSeries
    ? "Live CoinGecko market history."
    : `Live CoinGecko price. 24h trend is ${trend}. Chart unavailable — latest quote only.`;
}

function getCryptoSeriesSource(coin, chart) {
  return chart?.cached ? `CoinGecko cached market_chart:${coin.id}` : `CoinGecko market_chart:${coin.id}`;
}

function getProviderChangeSource(provider) {
  return provider === "coinbase" ? "unavailable" : "coingecko_24h";
}

function cacheCoinGeckoStats(coinId, priceData) {
  const usd = Number(priceData.usd);
  const rawChange = Number(priceData.usd_24h_change);
  const changeAvailable = typeof priceData.changeAvailable === "boolean"
    ? priceData.changeAvailable && Number.isFinite(rawChange)
    : Number.isFinite(rawChange);

  if (!Number.isFinite(usd) || usd <= 0) return;

  const previous = lastSuccessfulCoinGeckoStats.get(coinId);
  lastSuccessfulCoinGeckoStats.set(coinId, {
    changeAvailable: changeAvailable || previous?.changeAvailable === true,
    changeSource: changeAvailable ? priceData.changeSource ?? "coingecko_24h" : previous?.changeSource ?? "unavailable",
    priceSource: priceData.priceSource ?? "coingecko_simple_price",
    provider: "coingecko",
    usd,
    ...(changeAvailable
      ? { usd_24h_change: rawChange }
      : Number.isFinite(previous?.usd_24h_change)
        ? { usd_24h_change: previous.usd_24h_change }
        : {}),
    usd_last_updated_at: priceData.usd_last_updated_at ?? previous?.usd_last_updated_at ?? Math.round(Date.now() / 1000),
  });
}

function getChartChange(chart) {
  const series = chart?.series ?? [];
  const first = series[0]?.value;
  const last = series.at(-1)?.value;

  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) {
    return undefined;
  }

  return ((last - first) / first) * 100;
}

function logFinalCryptoResponse(assets, provider) {
  if (!DEBUG_MARKET) return;

  for (const asset of assets) {
    console.info(
      `[crypto-response] ${asset.symbol} provider=${provider} source=${asset.source} changeAvailable=${asset.changeAvailable !== false} change=${Number(asset.change).toFixed(2)} seriesSource=${asset.seriesSource} points=${asset.series?.length ?? 0}`,
    );
  }
}

function logCryptoDebug(...messages) {
  if (!DEBUG_MARKET) return;
  console.info(...messages);
}

function warnCryptoProviderFailure(key, prefix, message) {
  const now = Date.now();
  const lastWarningAt = warningTimestamps.get(key) ?? 0;
  if (now - lastWarningAt < WARNING_THROTTLE_MS) return;

  warningTimestamps.set(key, now);
  console.warn(prefix, message);
}

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function toQuote(asset) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    price: Number(String(asset.value).replace(/[$,]/g, "")),
    changePercent: asset.change,
    changeAvailable: asset.changeAvailable,
    changeSource: asset.changeSource,
    trend: asset.trend ?? getTrend(asset.change),
    category: asset.category,
  };
}

function getTrend(changePercent) {
  if (changePercent > 0.05) return "up";
  if (changePercent < -0.05) return "down";
  return "flat";
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatSigned(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatChartTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "";

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
