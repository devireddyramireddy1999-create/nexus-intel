import Parser from "rss-parser";
import { geopoliticalWatch, riskSignals, techSignals, topStories } from "../data/mockData.js";

const RSS_TIMEOUT_MS = 12_000;
const ARTICLES_PER_FEED = 8;
const ARTICLES_PER_CATEGORY = 8;

const rssFeeds = [
  {
    category: "world",
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    category: "world",
    name: "NPR World",
    url: "https://feeds.npr.org/1004/rss.xml",
  },
  {
    category: "geopolitics",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    category: "markets",
    name: "CNBC Markets",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
  {
    category: "markets",
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
  },
  {
    category: "ai-tech",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    category: "ai-tech",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
  },
];

const parser = new Parser({
  headers: {
    "user-agent": "NEXUS-Intel/0.1",
  },
  maxRedirects: 5,
  requestOptions: {
    family: 4,
  },
  timeout: RSS_TIMEOUT_MS,
});

const categoryLabels = {
  world: "World",
  geopolitics: "Geopolitics",
  markets: "Markets",
  "ai-tech": "AI & Tech",
  crypto: "Crypto",
};

const categoryMap = {
  World: "world",
  Markets: "markets",
  Geopolitics: "geopolitics",
  "AI & Tech": "ai-tech",
  Crypto: "crypto",
};

const riskBySentiment = {
  bullish: "low",
  neutral: "medium",
  caution: "high",
  risk: "critical",
};

const sentimentByRisk = {
  low: "neutral",
  medium: "caution",
  high: "risk",
  critical: "risk",
};

const publishedAt = [
  "2026-05-20T06:10:00-04:00",
  "2026-05-20T06:22:00-04:00",
  "2026-05-20T06:35:00-04:00",
  "2026-05-20T06:48:00-04:00",
];

const whyItMattersByCategory = {
  world: "This changes the macro backdrop that influences rates, trade flows, policy risk, and cross-asset positioning.",
  geopolitics: "This can affect security posture, supply chains, energy routes, defense demand, and regional risk premiums.",
  markets: "This can move rate expectations, dollar liquidity, commodities, and equity risk appetite.",
  crypto: "This can influence liquidity, risk appetite, and the relative bid for digital assets.",
  "ai-tech": "This can affect AI infrastructure demand, chip supply chains, cybersecurity budgets, and platform competition.",
};

const marketImpactByCategory = {
  world: "Watch rates, the dollar, energy, and defensive assets for second-order moves.",
  geopolitics: "Energy, shipping, defense tech, semiconductors, and insurance costs are most exposed.",
  markets: "Index breadth, commodities, treasury yields, and USD-sensitive assets should react first.",
  crypto: "Crypto beta can strengthen when liquidity improves and weaken when dollar stress rises.",
  "ai-tech": "AI infrastructure, semiconductors, cloud, networking, power, and security names are the likely transmission channels.",
};

const categoryKeywords = {
  geopolitics: ["war", "sanctions", "military", "diplomacy", "border", "security", "election", "conflict", "iran", "ukraine", "russia"],
  markets: ["inflation", "central bank", "oil", "dollar", "stocks", "stock", "shares", "economy", "treasury", "earnings", "revenue", "wall street", "yield", "yields", "walmart"],
  "ai-tech": ["artificial intelligence", "ai", "chip", "chips", "semiconductor", "cybersecurity", "openai", "nvidia"],
};

const riskKeywords = {
  critical: ["attack", "missile", "invasion", "nuclear", "terror", "emergency", "crisis"],
  high: ["war", "sanction", "military", "conflict", "border", "strike", "oil", "inflation", "cyberattack"],
  medium: ["election", "trade", "tariff", "central bank", "dollar", "security", "semiconductor", "chip"],
};

export async function getNews() {
  try {
    const newsItems = await fetchRssNews();

    if (!newsItems.length) {
      throw new Error("RSS feeds returned no usable articles.");
    }

    return {
      data: {
        stories: buildStories(newsItems),
        newsItems,
        geopoliticalWatch: buildGeopoliticalWatch(newsItems),
        riskSignals: buildRiskSignals(newsItems),
        techSignals: buildTechSignals(newsItems),
      },
      meta: {
        fallback: false,
        source: "rss",
      },
    };
  } catch (error) {
    return {
      data: getFallbackNewsData(),
      meta: {
        error: error instanceof Error ? error.message : "RSS news request failed.",
        fallback: true,
        source: "mock",
      },
    };
  }
}

async function fetchRssNews() {
  const results = await Promise.allSettled(rssFeeds.map(fetchFeedArticles));
  const articles = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const deduped = dedupeArticles(articles);

  if (!deduped.length) {
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message)
      .filter(Boolean);
    throw new Error(errors[0] ?? "RSS feeds returned no usable articles.");
  }

  return limitArticlesByCategory(deduped);
}

async function fetchFeedArticles(feed) {
  const parsedFeed = await parser.parseURL(feed.url);
  const items = Array.isArray(parsedFeed.items) ? parsedFeed.items : [];

  return items
    .slice(0, ARTICLES_PER_FEED)
    .map((item, index) => normalizeRssArticle({ feed, item, index }))
    .filter((item) => item.title && item.url);
}

function normalizeRssArticle({ feed, item, index }) {
  const title = cleanText(item.title) || `${categoryLabels[feed.category]} update`;
  const summary = cleanSummary(item.contentSnippet || item.summary || item.content || title);
  const source = feed.name;
  const category = inferCategory({ feedCategory: feed.category, source, summary, title, url: item.link });
  const riskLevel = getRiskLevel(`${title} ${summary}`);
  const importanceScore = getImportanceScore({ category, index, riskLevel, title });
  const published = parsePublishedDate(item.isoDate || item.pubDate);

  return {
    id: `${category}-${hashId(item.guid || item.link || title)}`,
    title,
    source,
    url: item.link || feed.url,
    category,
    publishedAt: published ?? new Date().toISOString(),
    summary: buildSummary({ category, source, summary, title }),
    importanceScore,
    riskLevel,
    whyItMatters: whyItMattersByCategory[category],
    marketImpact: marketImpactByCategory[category],
    sourceType: "rss",
  };
}

function getFallbackNewsData() {
  const newsItems = topStories.map(toFallbackNewsItem);

  return {
    stories: topStories.map((story, index) => ({
      ...story,
      publishedAt: publishedAt[index] ?? publishedAt[0],
      source: "NEXUS Mock Wire",
      sourceType: "fallback",
      url: `https://mock.nexus.local/news/${story.id}`,
    })),
    newsItems,
    geopoliticalWatch,
    riskSignals,
    techSignals,
  };
}

function toFallbackNewsItem(story, index) {
  const category = categoryMap[story.section];

  return {
    id: story.id,
    title: story.title,
    source: "NEXUS Mock Wire",
    url: `https://mock.nexus.local/news/${story.id}`,
    category,
    publishedAt: publishedAt[index] ?? publishedAt[0],
    importanceScore: story.confidence,
    riskLevel: riskBySentiment[story.sentiment],
    summary: story.summary,
    whyItMatters: story.impact,
    marketImpact: marketImpactByCategory[category],
    sourceType: "fallback",
  };
}

function buildStories(newsItems) {
  return [...newsItems]
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .map((item) => ({
      id: item.id,
      section: categoryLabels[item.category],
      title: item.title,
      summary: item.summary,
      impact: item.whyItMatters,
      sentiment: sentimentByRisk[item.riskLevel],
      confidence: item.importanceScore,
      publishedAt: item.publishedAt,
      source: item.source,
      sourceType: item.sourceType,
      url: item.url,
    }));
}

function buildGeopoliticalWatch(newsItems) {
  const geopoliticalItems = newsItems.filter((item) => item.category === "geopolitics").slice(0, 4);

  return geopoliticalItems.map((item) => ({
    region: inferRegion(item.title),
    title: item.title,
    signal: item.whyItMatters,
    severity: item.riskLevel === "critical" || item.riskLevel === "high" ? "High" : "Medium",
  }));
}

function buildRiskSignals(newsItems) {
  const averageRisk = Math.round(
    newsItems.reduce((total, item) => total + riskScore(item.riskLevel), 0) / Math.max(newsItems.length, 1),
  );
  const geopoliticsRisk = categoryRisk(newsItems, "geopolitics");
  const marketRisk = categoryRisk(newsItems, "markets");
  const techRisk = categoryRisk(newsItems, "ai-tech");

  return [
    {
      label: "Global Risk",
      value: averageRisk,
      posture: postureForValue(averageRisk),
      description: "Live RSS headlines are being scored for conflict, policy, inflation, and security pressure.",
    },
    {
      label: "Geopolitics",
      value: geopoliticsRisk,
      posture: postureForValue(geopoliticsRisk),
      description: "Military, sanctions, border, diplomacy, and security headlines are driving this channel.",
    },
    {
      label: "Markets",
      value: marketRisk,
      posture: postureForValue(marketRisk),
      description: "Inflation, central bank, oil, dollar, and economy coverage shape the market risk read.",
    },
    {
      label: "Technology",
      value: techRisk,
      posture: postureForValue(techRisk),
      description: "AI, chips, and cybersecurity coverage determine the technology signal surface.",
    },
  ];
}

function buildTechSignals(newsItems) {
  const techItems = newsItems.filter((item) => item.category === "ai-tech").slice(0, 3);

  return techItems.map((item) => ({
    label: inferTechLabel(item.title),
    title: item.title,
    detail: item.summary,
    velocity: item.importanceScore,
  }));
}

function inferCategory({ source, summary, title, url }) {
  const text = `${title} ${summary} ${source} ${url ?? ""}`.toLowerCase();

  if (hasCompanyMarketSignal(text)) return "markets";
  if (hasKeyword(text, categoryKeywords.geopolitics)) return "geopolitics";
  if (hasMarketMovementSignal(text)) return "markets";
  if (hasKeyword(text, categoryKeywords["ai-tech"])) return "ai-tech";
  if (hasKeyword(text, categoryKeywords.markets)) return "markets";

  return "world";
}

function hasCompanyMarketSignal(text) {
  return /\b(walmart|target|amazon|apple|microsoft|tesla|meta|alphabet|google|ibm|oracle|salesforce|netflix|spotify|stellantis|spacex|starlink)\b/.test(text) &&
    /\b(stock|stocks|shares|earnings|revenue|profit|sales|guidance|outlook|cash flow|market value|turnaround|ipo|investor day)\b/.test(text);
}

function hasMarketMovementSignal(text) {
  return /\b(stock|stocks|shares|earnings|revenue|profit|sales|guidance|ipo|investor day|equity stake|equity stakes)\b/.test(text) ||
    /\b(soar|soars|surge|surges|jump|jumps|pop|pops|fall|falls|drop|drops|slump|slumps)\b/.test(text) &&
      /\b(market|markets|stock|stocks|shares|wall street|nasdaq|s&p|dow)\b/.test(text);
}

function limitArticlesByCategory(newsItems) {
  const counts = new Map();
  const selected = [];

  for (const item of newsItems.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const count = counts.get(item.category) ?? 0;
    if (count >= ARTICLES_PER_CATEGORY) continue;

    selected.push(item);
    counts.set(item.category, count + 1);
  }

  return selected;
}

function dedupeArticles(articles) {
  const seen = new Set();

  return articles.filter((article) => {
    const key = article.url || article.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanSummary(value) {
  const text = cleanText(stripHtml(value));
  return text.length > 260 ? `${text.slice(0, 257).trim()}...` : text;
}

function stripHtml(value) {
  return cleanText(value).replace(/<[^>]*>/g, " ");
}

function parsePublishedDate(value) {
  if (!value) return null;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function buildSummary({ category, source, summary, title }) {
  const text = summary && summary !== title ? summary : `${source} is reporting a ${categoryLabels[category].toLowerCase()} development: ${title}`;
  return text;
}

function getRiskLevel(text) {
  const normalized = text.toLowerCase();

  if (hasKeyword(normalized, riskKeywords.critical)) return "critical";
  if (hasKeyword(normalized, riskKeywords.high)) return "high";
  if (hasKeyword(normalized, riskKeywords.medium)) return "medium";
  return "low";
}

function hasKeyword(text, keywords) {
  return keywords.some((keyword) => new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i").test(text));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImportanceScore({ category, index, riskLevel, title }) {
  const normalized = title.toLowerCase();
  const baseByCategory = {
    world: 72,
    geopolitics: 78,
    markets: 74,
    "ai-tech": 76,
  };
  const riskBoost = {
    low: 0,
    medium: 6,
    high: 12,
    critical: 18,
  };
  const lengthBoost = Math.min(Math.floor(title.length / 35), 4);
  const impactBoost =
    (category === "geopolitics" && /\b(war|sanction|military|diplomacy|border|security|conflict|oil|iran|ukraine|russia)\b/.test(normalized) ? 7 : 0) +
    (category === "markets" && /\b(walmart|stocks|shares|earnings|inflation|central bank|treasury|oil|dollar|economy)\b/.test(normalized) ? 6 : 0) +
    (category === "ai-tech" && /\b(artificial intelligence|openai|nvidia|chip|semiconductor|cybersecurity)\b/.test(normalized) ? 5 : 0);
  const lowImpactPenalty = /\b(appoints|appointment|joins|hiring|promotion|board|chief people|executive appointment)\b/.test(normalized) ? 14 : 0;
  const score = baseByCategory[category] + riskBoost[riskLevel] + lengthBoost + impactBoost - lowImpactPenalty - index;

  return Math.max(55, Math.min(96, score));
}

function hashId(value) {
  let hash = 0;
  const input = String(value);

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function inferRegion(title) {
  const normalized = title.toLowerCase();

  if (/(china|taiwan|japan|korea|pacific|asia)/.test(normalized)) return "Indo-Pacific";
  if (/(ukraine|russia|europe|nato|eu\b)/.test(normalized)) return "Europe";
  if (/(iran|israel|gaza|red sea|middle east|syria|iraq)/.test(normalized)) return "Middle East";
  if (/(india|pakistan|south asia)/.test(normalized)) return "South Asia";
  if (/(africa|sudan|sahel)/.test(normalized)) return "Africa";
  if (/(america|mexico|canada|brazil)/.test(normalized)) return "Americas";
  return "Global Security";
}

function inferTechLabel(title) {
  const normalized = title.toLowerCase();

  if (/(chip|semiconductor|gpu|nvidia)/.test(normalized)) return "Chips";
  if (/(cyber|security|hack|breach)/.test(normalized)) return "Security";
  if (/(openai|artificial intelligence|ai|model)/.test(normalized)) return "AI";
  return "Tech";
}

function riskScore(level) {
  return {
    low: 48,
    medium: 62,
    high: 76,
    critical: 88,
  }[level];
}

function categoryRisk(newsItems, category) {
  const items = newsItems.filter((item) => item.category === category);

  if (!items.length) return 55;

  return Math.round(items.reduce((total, item) => total + riskScore(item.riskLevel), 0) / items.length);
}

function postureForValue(value) {
  if (value >= 80) return "critical";
  if (value >= 66) return "elevated";
  if (value >= 54) return "guarded";
  return "low";
}
