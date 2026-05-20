import { geopoliticalWatch, riskSignals, techSignals, topStories } from "../data/mockData.js";

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

const publishedAt = [
  "2026-05-20T06:10:00-04:00",
  "2026-05-20T06:22:00-04:00",
  "2026-05-20T06:35:00-04:00",
  "2026-05-20T06:48:00-04:00",
];

const marketImpactByCategory = {
  world: "Macro volatility can feed through rates, dollar liquidity, and defensive assets.",
  geopolitics: "Supply chains, energy pricing, freight costs, and defense technology sentiment are most exposed.",
  markets: "Index breadth and treasury sensitivity should drive near-term risk positioning.",
  crypto: "Spot-led crypto strength is constructive while funding remains disciplined.",
  "ai-tech": "AI infrastructure, networking, power, security, and software platforms remain the primary beneficiaries.",
};

export async function getNews() {
  return {
    stories: topStories,
    newsItems: topStories.map(toNewsItem),
    geopoliticalWatch,
    riskSignals,
    techSignals,
  };
}

function toNewsItem(story, index) {
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
  };
}
