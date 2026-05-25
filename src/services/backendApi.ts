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
  TrendPoint,
  WatchItem,
} from "@/types/intel";
import { buildAccessHeaders, clearAccessToken } from "@/services/accessService";
import type { MarketAssetQuote } from "@/services/marketService";
import type { NewsItem } from "@/services/newsService";

export type ApiMeta = {
  cached: boolean;
  cachedAt: string;
  cacheable?: boolean;
  expiresAt?: string;
  fallback: boolean;
  source: "api" | "coinbase" | "coingecko" | "finnhub" | "local" | "openai" | "rss" | "mock";
  stale?: boolean;
  ttlMs?: number;
  error?: string;
  warning?: string;
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

const liveCachePrefix = "nexus-live-cache:v3:";
const retryDelays = [800, 1500, 2500];

export async function getMarketsData(): Promise<ApiResult<MarketsApiData>> {
  const response = await fetchWithFallback("/api/markets", buildMarketsFallback);
  return normalizeMarketsResult(response);
}

export async function getCryptoData(): Promise<ApiResult<CryptoApiData>> {
  const response = await fetchWithFallback("/api/crypto", buildCryptoFallback);
  return normalizeCryptoResult(response);
}

export async function getNewsData(): Promise<ApiResult<NewsApiData>> {
  return fetchWithFallback("/api/news", buildNewsFallback);
}

export async function postBriefing<T>(payload: unknown): Promise<ApiResult<T>> {
  return requestWithRetry<ApiEnvelope<T>>("/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getCachedMarketsData(): ApiResult<MarketsApiData> | null {
  const cached = readLiveCache<MarketsApiData>("/api/markets");
  return cached ? normalizeMarketsResult(cached) : null;
}

export function getCachedCryptoData(): ApiResult<CryptoApiData> | null {
  const cached = readLiveCache<CryptoApiData>("/api/crypto");
  return cached ? normalizeCryptoResult(cached) : null;
}

export function getCachedNewsData(): ApiResult<NewsApiData> | null {
  return readLiveCache<NewsApiData>("/api/news");
}

async function fetchWithFallback<T>(path: string, fallback: () => T): Promise<ApiResult<T>> {
  try {
    const envelope = await requestWithRetry<ApiEnvelope<T>>(path, undefined, shouldRetryEnvelope);
    writeLiveCache(path, envelope);
    return envelope;
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

async function requestWithRetry<T>(
  path: string,
  init?: RequestInit,
  shouldRetryResult: (result: T) => boolean = () => false,
): Promise<T> {
  let lastError: unknown;
  let lastRetryableResult: T | null = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const result = await request<T>(path, init);

      if (shouldRetryResult(result) && attempt < retryDelays.length) {
        lastRetryableResult = result;
        await delay(retryDelays[attempt]);
        continue;
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < retryDelays.length) {
        await delay(retryDelays[attempt]);
      }
    }
  }

  if (lastRetryableResult) {
    return lastRetryableResult;
  }

  throw lastError instanceof Error ? lastError : new Error("Backend route unavailable.");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const accessHeaders = buildAccessHeaders();

  for (const [key, value] of Object.entries(accessHeaders)) {
    headers.set(key, value);
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }

    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function shouldRetryEnvelope<T>(result: ApiEnvelope<T>) {
  return Boolean(result?.meta?.fallback || result?.meta?.source === "mock");
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readLiveCache<T>(path: string): ApiResult<T> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(liveCachePrefix + path);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ApiResult<T>;
    if (!parsed?.data || parsed.meta?.fallback) return null;

    return {
      data: parsed.data,
      meta: {
        ...parsed.meta,
        cached: true,
        stale: true,
      },
    };
  } catch {
    return null;
  }
}

function writeLiveCache<T>(path: string, result: ApiResult<T>) {
  if (
    typeof window === "undefined" ||
    result.meta.cacheable === false ||
    result.meta.fallback ||
    result.meta.source === "coinbase" ||
    result.meta.source === "mock"
  ) return;

  try {
    window.localStorage.setItem(
      liveCachePrefix + path,
      JSON.stringify({
        data: result.data,
        meta: {
          ...result.meta,
          cachedAt: new Date().toISOString(),
          stale: false,
        },
      }),
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser modes.
  }
}

function normalizeMarketsResult(result: ApiResult<MarketsApiData>): ApiResult<MarketsApiData> {
  const assets = result.data.assets.map(normalizeMarketAsset);

  return {
    ...result,
    data: {
      ...result.data,
      assets,
      quotes: result.data.quotes?.length ? result.data.quotes : assets.map(toQuote),
    },
  };
}

function normalizeCryptoResult(result: ApiResult<CryptoApiData>): ApiResult<CryptoApiData> {
  return {
    ...result,
    data: {
      ...result.data,
      assets: result.data.assets.map(normalizeMarketAsset),
    },
  };
}

type ApiMarketAsset = DashboardMarketAsset & {
  chart?: TrendPoint[] | { series?: TrendPoint[] };
  chartData?: TrendPoint[];
  history?: TrendPoint[];
  points?: TrendPoint[];
  sparkline?: TrendPoint[];
};

function normalizeMarketAsset(asset: DashboardMarketAsset): DashboardMarketAsset {
  const apiAsset = asset as ApiMarketAsset;
  const chartSeries = Array.isArray(apiAsset.chart) ? apiAsset.chart : apiAsset.chart?.series;
  const series = firstValidSeries([
    apiAsset.series,
    apiAsset.history,
    apiAsset.chartData,
    chartSeries,
    apiAsset.sparkline,
    apiAsset.points,
  ]);

  return {
    ...asset,
    series,
    seriesSource: series.length >= 2 ? asset.seriesSource : "latest-quote-only",
  };
}

function firstValidSeries(seriesCandidates: Array<TrendPoint[] | undefined>) {
  for (const candidate of seriesCandidates) {
    const series = normalizeSeries(candidate);

    if (series.length >= 2) return series;
  }

  return [];
}

function normalizeSeries(series: TrendPoint[] | undefined) {
  if (!Array.isArray(series)) return [];

  return series
    .map((point) => ({
      time: String(point?.time ?? ""),
      value: Number(point?.value),
    }))
    .filter((point) => point.time && Number.isFinite(point.value));
}

function buildMarketsFallback(): MarketsApiData {
  const assets = marketAssets.map(withoutChartHistory);

  return {
    assets,
    quotes: assets.map(toQuote),
    sectorHeat,
    macroTimeline,
  };
}

function buildCryptoFallback(): CryptoApiData {
  const assets = marketAssets.filter((asset) => asset.category === "Crypto").map(withoutChartHistory);

  return {
    assets,
    radar: cryptoRadar,
  };
}

function withoutChartHistory(asset: DashboardMarketAsset): DashboardMarketAsset {
  return {
    ...asset,
    note: `${asset.note} Latest quote only; live chart history unavailable.`,
    series: [],
    seriesSource: "latest-quote-only",
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
    changeAvailable: asset.changeAvailable,
    changeSource: asset.changeSource,
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
    sourceType: "fallback",
    coveredBy: ["NEXUS Local Fallback"],
    sourceCount: 1,
  };
}
