import { topStories } from "@/data/mockData";
import { getNewsData } from "@/services/backendApi";

export type NewsCategory = "world" | "geopolitics" | "markets" | "crypto" | "ai-tech";

export type NewsRiskLevel = "low" | "medium" | "high" | "critical";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  category: NewsCategory;
  publishedAt: string;
  importanceScore: number;
  riskLevel: NewsRiskLevel;
  summary: string;
  whyItMatters: string;
  marketImpact: string;
  sourceType?: "rss" | "fallback";
  coveredBy?: string[];
  sourceCount?: number;
};

export type NewsQuery = {
  categories?: NewsCategory[];
  limit?: number;
  minImportanceScore?: number;
  since?: string;
};

export interface NewsDataSource {
  fetchNews(query?: NewsQuery): Promise<NewsItem[]>;
}

export interface NewsService {
  getTopStories(query?: NewsQuery): Promise<NewsItem[]>;
  getByCategory(category: NewsCategory, query?: Omit<NewsQuery, "categories">): Promise<NewsItem[]>;
}

const categoryMap = {
  World: "world",
  Markets: "markets",
  Geopolitics: "geopolitics",
  "AI & Tech": "ai-tech",
  Crypto: "crypto",
} as const;

const riskBySentiment = {
  bullish: "low",
  neutral: "medium",
  caution: "high",
  risk: "critical",
} as const;

const mockPublishedAt = [
  "2026-05-19T06:10:00-04:00",
  "2026-05-19T06:22:00-04:00",
  "2026-05-19T06:35:00-04:00",
  "2026-05-19T06:48:00-04:00",
];

const marketImpactByCategory: Record<NewsCategory, string> = {
  world: "Macro volatility can feed through rates, dollar liquidity, and defensive assets.",
  geopolitics: "Supply chains, energy pricing, freight costs, and defense technology sentiment are most exposed.",
  markets: "Index breadth and treasury sensitivity should drive near-term risk positioning.",
  crypto: "Spot-led crypto strength is constructive while funding remains disciplined.",
  "ai-tech": "AI infrastructure, networking, power, security, and software platforms remain the primary beneficiaries.",
};

const mockNewsItems: NewsItem[] = topStories.map((story, index) => {
  const category = categoryMap[story.section];

  return {
    id: story.id,
    title: story.title,
    source: "NEXUS Mock Wire",
    url: `https://mock.nexus.local/news/${story.id}`,
    category,
    publishedAt: mockPublishedAt[index] ?? mockPublishedAt[0],
    importanceScore: story.confidence,
    riskLevel: riskBySentiment[story.sentiment],
    summary: story.summary,
    whyItMatters: story.impact,
    marketImpact: marketImpactByCategory[category],
    sourceType: "fallback",
  };
});

class MockNewsDataSource implements NewsDataSource {
  async fetchNews(query?: NewsQuery) {
    return filterNews(mockNewsItems, query);
  }
}

class BackendNewsDataSource implements NewsDataSource {
  async fetchNews(query?: NewsQuery) {
    const response = await getNewsData();
    return filterNews(response.data.newsItems, query);
  }
}

class NexusNewsService implements NewsService {
  constructor(private readonly dataSource: NewsDataSource) {}

  async getTopStories(query?: NewsQuery) {
    const stories = await this.dataSource.fetchNews(query);
    return stories.sort((a, b) => b.importanceScore - a.importanceScore);
  }

  async getByCategory(category: NewsCategory, query?: Omit<NewsQuery, "categories">) {
    return this.getTopStories({ ...query, categories: [category] });
  }
}

function filterNews(items: NewsItem[], query?: NewsQuery) {
  const sinceTime = query?.since ? Date.parse(query.since) : null;

  const filtered = items.filter((item) => {
    const categoryMatch = !query?.categories?.length || query.categories.includes(item.category);
    const importanceMatch = !query?.minImportanceScore || item.importanceScore >= query.minImportanceScore;
    const sinceMatch = !sinceTime || Date.parse(item.publishedAt) >= sinceTime;
    return categoryMatch && importanceMatch && sinceMatch;
  });

  return typeof query?.limit === "number" ? filtered.slice(0, query.limit) : filtered;
}

export function createNewsService(dataSource: NewsDataSource = new BackendNewsDataSource()): NewsService {
  return new NexusNewsService(dataSource);
}

export const newsService = createNewsService();
export const localNewsService = createNewsService(new MockNewsDataSource());
