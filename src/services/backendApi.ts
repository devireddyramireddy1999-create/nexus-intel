import {
  cryptoRadar,
  geopoliticalWatch,
  macroTimeline,
  marketAssets,
  riskSignals,
  sectorHeat,
  techSignals,
  topStories,
} from "@/data/mockData";
import type {
  CryptoSignal,
  IntelligenceStory,
  MarketAsset as DashboardMarketAsset,
  RiskSignal,
  TechSignal,
  WatchItem,
} from "@/types/intel";
import type { MarketAssetQuote } from "@/services/marketService";
import type { NewsItem } from "@/services/newsService";

export type ApiMeta = {
  cached: boolean;
  cachedAt: string;
  expiresAt?: string;
  fallback: boolean;
  source: "api" | "mock";
  ttlMs?: number;
  error?: string;
};

export type ApiResult<T> = {
  data: T;
  meta: ApiMeta;
};

export type MarketsApiData = {
  assets: DashboardMarketAsset[];
  quotes: MarketAssetQuote[];
  sectorHeat: typeof sectorHeat;
  macroTimeline: typeof macroTimeline;
};

export type CryptoApiData = {
  assets: DashboardMarketAsset[];
  radar: CryptoSignal[];
};

export type NewsApiData = {
  stories: IntelligenceStory[];
  newsItems: NewsItem[];
  geopoliticalWatch: WatchItem[];
  riskSignals: RiskSignal[];
  techSignals: TechSignal[];
};

type ApiEnvelope<T> = {
  data: T;
  meta: ApiMeta;
};

const fallbackMeta: ApiMeta = {
  cached: false,
  cachedAt: new Date(0).toISOString(),
  fallback: true,
  source: "mock",
};

export async function getMarketsData(): Promise<ApiResult<MarketsApiData>> {
  return fetchWithFallback("/api/markets", buildMarketsFallback);
}

export async function getCryptoData(): Promise<ApiResult<CryptoApiData>> {
  return fetchWithFallback("/api/crypto", buildCryptoFallback);
}

export async function getNewsData(): Promise<ApiResult<NewsApiData>> {
  return fetchWithFallback("/api/news", buildNewsFallback);
}

export async function postBriefing<T>(payload: unknown): Promise<ApiResult<T>> {
  const envelope = await request<ApiEnvelope<T>>("/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return envelope;
}

async function fetchWithFallback<T>(path: string, fallback: () => T): Promise<ApiResult<T>> {
  try {
    return await request<ApiEnvelope<T>>(path);
  } catch (error) {
    return {
      data: fallback(),
      meta: {
        ...fallbackMeta,
        cachedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Backend route unavailable.",
      },
    };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function buildMarketsFallback(): MarketsApiData {
  return {
    assets: marketAssets,
    quotes: marketAssets.map(toQuote),
    sectorHeat,
    macroTimeline,
  };
}

function buildCryptoFallback(): CryptoApiData {
  return {
    assets: marketAssets.filter((asset) => asset.category === "Crypto"),
    radar: cryptoRadar,
  };
}

function buildNewsFallback(): NewsApiData {
  return {
    stories: topStories,
    newsItems: topStories.map(toNewsItem),
    geopoliticalWatch,
    riskSignals,
    techSignals,
  };
}

function toQuote(asset: DashboardMarketAsset): MarketAssetQuote {
  return {
    symbol: asset.symbol,
    name: asset.name,
    price: Number(asset.value.replace(/[$,]/g, "")),
    changePercent: asset.change,
    trend: asset.change > 0.05 ? "up" : asset.change < -0.05 ? "down" : "flat",
    category: asset.category,
  };
}

function toNewsItem(story: IntelligenceStory, index: number): NewsItem {
  const category = {
    World: "world",
    Markets: "markets",
    Geopolitics: "geopolitics",
    "AI & Tech": "ai-tech",
    Crypto: "crypto",
  }[story.section] as NewsItem["category"];

  const riskLevel = {
    bullish: "low",
    neutral: "medium",
    caution: "high",
    risk: "critical",
  }[story.sentiment] as NewsItem["riskLevel"];

  const marketImpactByCategory: Record<NewsItem["category"], string> = {
    world: "Macro volatility can feed through rates, dollar liquidity, and defensive assets.",
    geopolitics: "Supply chains, energy pricing, freight costs, and defense technology sentiment are most exposed.",
    markets: "Index breadth and treasury sensitivity should drive near-term risk positioning.",
    crypto: "Spot-led crypto strength is constructive while funding remains disciplined.",
    "ai-tech": "AI infrastructure, networking, power, security, and software platforms remain the primary beneficiaries.",
  };

  return {
    id: story.id,
    title: story.title,
    source: "NEXUS Local Fallback",
    url: `https://mock.nexus.local/news/${story.id}`,
    category,
    publishedAt: new Date(Date.now() - index * 900_000).toISOString(),
    importanceScore: story.confidence,
    riskLevel,
    summary: story.summary,
    whyItMatters: story.impact,
    marketImpact: marketImpactByCategory[category],
  };
}
