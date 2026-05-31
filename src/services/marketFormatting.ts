import type { MarketAsset } from "@/types/intel";

const usdNoDecimals = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "currency",
});

const usdTwoDecimals = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const fxTwoDecimals = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatMarketAssetValue(asset: MarketAsset) {
  const price = getMarketAssetPrice(asset);

  if (!Number.isFinite(price) || price <= 0) {
    return asset.category === "FX" ? "Latest quote unavailable" : "Unavailable";
  }

  if (asset.category === "FX" || asset.symbol === "USDINR") {
    return `${fxTwoDecimals.format(price)} INR`;
  }

  if (asset.category === "Crypto") {
    return price >= 1000 ? usdNoDecimals.format(price) : usdTwoDecimals.format(price);
  }

  return usdTwoDecimals.format(price);
}

export function getMarketAssetPrice(asset: Pick<MarketAsset, "price" | "value">) {
  if (typeof asset.price === "number" && Number.isFinite(asset.price)) return asset.price;

  return parseDisplayNumber(asset.value);
}

export function parseDisplayNumber(value: string) {
  const normalized = String(value)
    .replace(/[₹$,]/g, "")
    .replace(/\bINR\b/gi, "")
    .trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
