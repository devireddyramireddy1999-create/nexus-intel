import { cryptoRadar } from "../data/mockData.js";
import { getCrypto } from "./marketProvider.js";

const COINGECKO_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices";

const coinMap = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
];

export async function getCryptoData() {
  try {
    const livePrices = await fetchCoinGeckoPrices();
    const crypto = await buildLiveCryptoData(livePrices, "coingecko");

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

      return {
        data: crypto,
        meta: {
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

async function buildLiveCryptoData(livePrices, provider) {
  const fallback = await getCrypto();
  const liveAssets = fallback.assets.map((asset) => {
    const coin = coinMap.find((item) => item.symbol === asset.symbol);
    const priceData = coin ? livePrices[coin.id] : undefined;

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
      note: getProviderNote(provider, trend, changeAvailable),
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

  return {
    ...crypto,
    quotes: crypto.assets.map(toQuote),
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

function getProviderNote(provider, trend, changeAvailable) {
  if (!changeAvailable) {
    return `Live ${getProviderLabel(provider)} spot price. 24h change is unavailable from this feed.`;
  }

  return `Live CoinGecko price. 24h trend is ${trend}.`;
}

function getProviderChangeSource(provider) {
  return provider === "coinbase" ? "unavailable" : "coingecko_24h";
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
