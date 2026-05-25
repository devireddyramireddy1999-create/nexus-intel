import { cryptoRadar } from "../data/mockData.js";
import { getCrypto } from "./marketProvider.js";

const COINGECKO_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
const COINGECKO_MARKET_CHART_URL = "https://api.coingecko.com/api/v3/coins";
const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices";

const coinMap = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
];

export async function getCryptoData() {
  try {
    const marketCharts = await fetchCoinGeckoMarketCharts();
    const livePrices = await fetchCoinGeckoPrices().catch((error) => {
      console.warn("CoinGecko simple price failed; deriving crypto prices from market_chart:", getErrorMessage(error, "CoinGecko simple price failed."));
      return buildCoinGeckoPricesFromMarketCharts(marketCharts);
    });
    const crypto = await buildLiveCryptoData(livePrices, "coingecko", marketCharts);
    logFinalCryptoResponse(crypto.assets, "coingecko");

    return {
      data: crypto,
      meta: {
        fallback: false,
        source: "coingecko",
      },
    };
  } catch (coinGeckoError) {
    console.warn("CoinGecko crypto provider failed:", getErrorMessage(coinGeckoError, "CoinGecko request failed."));
    try {
      const livePrices = await fetchCoinbasePrices();
      const crypto = await buildLiveCryptoData(livePrices, "coinbase");
      logFinalCryptoResponse(crypto.assets, "coinbase");

      return {
        data: crypto,
        meta: {
          cacheable: false,
          fallback: false,
          source: "coinbase",
          warning: getErrorMessage(coinGeckoError, "CoinGecko request failed."),
        },
      };
    } catch (coinbaseError) {
      console.warn("Coinbase crypto provider failed:", getErrorMessage(coinbaseError, "Coinbase request failed."));
      const crypto = await getFallbackCryptoData();

      return {
        data: crypto,
        meta: {
          error: `${getErrorMessage(coinGeckoError, "CoinGecko request failed.")} ${getErrorMessage(coinbaseError, "Coinbase request failed.")}`,
          fallback: true,
          source: "mock",
        },
      };
    }
  }
}

async function fetchCoinGeckoMarketCharts() {
  const results = await Promise.allSettled(
    coinMap.map(async (coin) => [coin.id, await fetchCoinGeckoMarketChart(coin.id)]),
  );

  const marketCharts = Object.fromEntries(
    results
      .filter((result) => result.status === "fulfilled" && result.value[1].length >= 2)
      .map((result) => result.value),
  );

  for (const [index, result] of results.entries()) {
    const coin = coinMap[index];
    const points = result.status === "fulfilled" ? result.value[1].length : 0;
    const error = result.status === "rejected" ? ` error="${getErrorMessage(result.reason, "market_chart request failed")}"` : "";
    console.info(`[crypto-history] ${coin.symbol} CoinGecko market_chart points=${points}${error}`);
  }

  if (coinMap.some((coin) => !marketCharts[coin.id]?.length)) {
    throw new Error("CoinGecko market_chart did not return complete BTC/ETH/SOL history.");
  }

  return marketCharts;
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

async function fetchCoinbasePrices() {
  const entries = await Promise.all(
    coinMap.map(async (coin) => {
      const payload = await fetchCoinbaseSpotPrice(coin.symbol);
      const price = Number(payload?.data?.amount);

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Coinbase response missing ${coin.symbol} price.`);
      }

      return [
        coin.id,
        {
          changeAvailable: false,
          changeSource: "unavailable",
          usd: price,
          usd_last_updated_at: Math.round(Date.now() / 1000),
        },
      ];
    }),
  );

  return Object.fromEntries(entries);
}

function buildCoinGeckoPricesFromMarketCharts(marketCharts) {
  return Object.fromEntries(
    coinMap.map((coin) => {
      const series = marketCharts[coin.id] ?? [];
      const first = series[0]?.value;
      const last = series.at(-1)?.value;

      if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) {
        throw new Error(`CoinGecko market_chart missing usable ${coin.symbol} price history.`);
      }

      return [
        coin.id,
        {
          changeSource: "coingecko_market_chart_24h",
          usd: last,
          usd_24h_change: ((last - first) / first) * 100,
          usd_last_updated_at: Math.round(Date.now() / 1000),
        },
      ];
    }),
  );
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

async function buildLiveCryptoData(livePrices, provider, marketCharts = {}) {
  const fallback = await getCrypto();
  const liveAssets = fallback.assets.map((asset) => {
    const coin = coinMap.find((item) => item.symbol === asset.symbol);
    const priceData = coin ? livePrices[coin.id] : undefined;
    const series = coin ? marketCharts[coin.id] ?? [] : [];
    const hasSeries = series.length >= 2;

    if (!priceData?.usd) {
      throw new Error(`${getProviderLabel(provider)} response missing ${asset.symbol} price.`);
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
      note: getProviderNote(provider, trend, changeAvailable, hasSeries),
      series: hasSeries ? series : [],
      seriesSource: hasSeries ? `CoinGecko market_chart:${coin.id}` : "latest-quote-only",
      source: getProviderLabel(provider),
      trend,
      value: formatUsd(priceData.usd),
    };
  });

  return {
    assets: liveAssets,
    quotes: liveAssets.map(toQuote),
    radar: buildLiveRadar(liveAssets, provider),
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

function buildLiveRadar(assets, provider) {
  const fallbackBySymbol = new Map(cryptoRadar.map((item) => [item.asset, item]));
  const providerLabel = getProviderLabel(provider);

  return assets.map((asset) => {
    const fallback = fallbackBySymbol.get(asset.symbol);
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

function getProviderNote(provider, trend, changeAvailable, hasSeries) {
  if (provider === "coinbase" || !changeAvailable) {
    return "Live Coinbase spot price. 24h change unavailable. Chart unavailable — latest quote only.";
  }

  return hasSeries
    ? "Live CoinGecko price. Chart uses CoinGecko market_chart history."
    : `Live CoinGecko price. 24h trend is ${trend}. Chart unavailable — latest quote only.`;
}

function getProviderChangeSource(provider) {
  return provider === "coinbase" ? "unavailable" : "coingecko_24h";
}

function logFinalCryptoResponse(assets, provider) {
  for (const asset of assets) {
    console.info(
      `[crypto-response] ${asset.symbol} provider=${provider} source=${asset.source} changeAvailable=${asset.changeAvailable !== false} change=${Number(asset.change).toFixed(2)} seriesSource=${asset.seriesSource} points=${asset.series?.length ?? 0}`,
    );
  }
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
