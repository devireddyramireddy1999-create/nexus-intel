import { macroTimeline, marketAssets, sectorHeat } from "../data/mockData.js";

export async function getMarkets() {
  return {
    assets: marketAssets,
    quotes: marketAssets.map(toQuote),
    sectorHeat,
    macroTimeline,
  };
}

export async function getCrypto() {
  return {
    assets: marketAssets.filter((asset) => asset.category === "Crypto"),
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
  };
}
