import { marketAssets } from "@/data/mockData";
import { getMarketsData } from "@/services/backendApi";

export type MarketAssetCategory = "Index" | "Crypto" | "Commodity" | "FX";

export type MarketTrend = "up" | "down" | "flat";

export type MarketAssetQuote = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  changeAvailable?: boolean;
  changeSource?: string;
  trend: MarketTrend;
  category: MarketAssetCategory;
  fallback?: boolean;
  source?: string;
};

export type MarketAsset = MarketAssetQuote;

export type MarketQuery = {
  symbols?: string[];
  categories?: MarketAssetCategory[];
};

export interface MarketDataSource {
  fetchMarketSnapshot(query?: MarketQuery): Promise<MarketAssetQuote[]>;
}

export interface MarketService {
  getMarketSnapshot(query?: MarketQuery): Promise<MarketAssetQuote[]>;
  getAsset(symbol: string): Promise<MarketAssetQuote | null>;
  getMarketSummary(query?: MarketQuery): Promise<string>;
}

const mockMarketQuotes: MarketAssetQuote[] = marketAssets.map((asset) => ({
  symbol: asset.symbol,
  name: asset.name,
  price: parsePrice(asset.value),
  changePercent: asset.change,
  trend: getTrend(asset.change),
  category: asset.category,
}));

class MockMarketDataSource implements MarketDataSource {
  async fetchMarketSnapshot(query?: MarketQuery) {
    return filterAssets(mockMarketQuotes, query);
  }
}

class BackendMarketDataSource implements MarketDataSource {
  async fetchMarketSnapshot(query?: MarketQuery) {
    const response = await getMarketsData();
    return filterAssets(response.data.quotes, query);
  }
}

class NexusMarketService implements MarketService {
  constructor(private readonly dataSource: MarketDataSource) {}

  async getMarketSnapshot(query?: MarketQuery) {
    return this.dataSource.fetchMarketSnapshot(query);
  }

  async getAsset(symbol: string) {
    const assets = await this.getMarketSnapshot({ symbols: [symbol] });
    return assets[0] ?? null;
  }

  async getMarketSummary(query?: MarketQuery) {
    const assets = await this.getMarketSnapshot(query);
    const leaders = [...assets].sort((a, b) => b.changePercent - a.changePercent);
    const strongest = leaders[0];
    const weakest = leaders[leaders.length - 1];

    if (!strongest || !weakest) {
      return "No market assets are available in the current data source.";
    }

    return `${strongest.name} leads at ${formatPercent(strongest.changePercent)}, while ${weakest.name} is the weakest read at ${formatPercent(weakest.changePercent)}.`;
  }
}

function filterAssets(assets: MarketAssetQuote[], query?: MarketQuery) {
  return assets.filter((asset) => {
    const symbolMatch = !query?.symbols?.length || query.symbols.includes(asset.symbol);
    const categoryMatch = !query?.categories?.length || query.categories.includes(asset.category);
    return symbolMatch && categoryMatch;
  });
}

function parsePrice(value: string) {
  return Number(value.replace(/[$,]/g, ""));
}

function getTrend(changePercent: number): MarketTrend {
  if (changePercent > 0.05) return "up";
  if (changePercent < -0.05) return "down";
  return "flat";
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function createMarketService(dataSource: MarketDataSource = new BackendMarketDataSource()): MarketService {
  return new NexusMarketService(dataSource);
}

export const marketService = createMarketService();
export const localMarketService = createMarketService(new MockMarketDataSource());
