import { cryptoRadar } from "../data/mockData.js";
import { getCrypto } from "./marketProvider.js";

const COINGECKO_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";

const coinMap = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
];

export async function getCryptoData() {
  try {
    const livePrices = await fetchCoinGeckoPrices();
    const crypto = await buildLiveCryptoData(livePrices);

    return {
      data: crypto,
      meta: {
        fallback: false,
        source: "coingecko",
      },
    };
  } catch (error) {
    const crypto = await getFallbackCryptoData();

    return {
      data: crypto,
      meta: {
        error: error instanceof Error ? error.message : "CoinGecko request failed.",
        fallback: true,
        source: "mock",
      },
    };
  }
}

async function fetchCoinGeckoPrices() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

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

async function buildLiveCryptoData(livePrices) {
  const fallback = await getCrypto();
  const liveAssets = fallback.assets.map((asset) => {
    const coin = coinMap.find((item) => item.symbol === asset.symbol);
    const priceData = coin ? livePrices[coin.id] : undefined;

    if (!priceData?.usd) {
      throw new Error(`CoinGecko response missing ${asset.symbol} price.`);
    }

    const change = Number(priceData.usd_24h_change ?? 0);
    const trend = getTrend(change);

    return {
      ...asset,
      change,
      lastUpdatedAt: priceData.usd_last_updated_at
        ? new Date(priceData.usd_last_updated_at * 1000).toISOString()
        : new Date().toISOString(),
      note: `Live CoinGecko price. 24h trend is ${trend}.`,
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

  return {
    ...crypto,
    quotes: crypto.assets.map(toQuote),
    radar: cryptoRadar,
  };
}

function buildLiveRadar(assets) {
  const fallbackBySymbol = new Map(cryptoRadar.map((item) => [item.asset, item]));

  return assets.map((asset) => {
    const fallback = fallbackBySymbol.get(asset.symbol);
    const direction = asset.trend === "up" ? "positive" : asset.trend === "down" ? "negative" : "flat";

    return {
      asset: asset.symbol,
      flow: `Live CoinGecko 24h change is ${formatSigned(asset.change)} with ${direction} price action.`,
      risk: fallback?.risk ?? "Macro liquidity and broad risk appetite remain the main swing factors.",
      score: fallback?.score ?? 70,
      thesis: fallback?.thesis ?? `${asset.name} trend is ${asset.trend} over the last 24 hours.`,
    };
  });
}

function toQuote(asset) {
  return {
    symbol: asset.symbol,
    name: asset.name,
    price: Number(String(asset.value).replace(/[$,]/g, "")),
    changePercent: asset.change,
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
