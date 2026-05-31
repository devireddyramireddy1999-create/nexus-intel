import { formatSigned } from "@/lib/utils";
import type { MarketAssetQuote } from "@/services/marketService";
import type { PersonalPriorityMemory, UserPreferenceMemory } from "@/services/memoryService";
import type { NewsItem, NewsRiskLevel } from "@/services/newsService";

export type AIBriefingUserPreferences = UserPreferenceMemory & {
  localGreeting?: string;
  priorities?: PersonalPriorityMemory[];
  suggestedActions?: string[];
};

export type AIDailyBriefing = {
  greeting: string;
  executiveSummary: string;
  worldSituation: string;
  geopoliticalRisk: string;
  marketSnapshot: string;
  cryptoWatch: string;
  aiTechSignals: string;
  personalPriorityRecommendation: string;
  actionListForTheDay: string[];
};

type AIBriefingRequest = {
  userInput: string;
  newsItems: NewsItem[];
  marketData: MarketAssetQuote[];
  userPreferences: AIBriefingUserPreferences;
};

export interface AIBriefingModelClient {
  generate(request: AIBriefingRequest): Promise<AIDailyBriefing>;
}

class MockAIBriefingModelClient implements AIBriefingModelClient {
  async generate({ userInput, newsItems, marketData, userPreferences }: AIBriefingRequest) {
    return buildMockDailyBriefing(userInput, newsItems, marketData, userPreferences);
  }
}

let aiBriefingModelClient: AIBriefingModelClient = new MockAIBriefingModelClient();

export function setAIBriefingModelClient(client: AIBriefingModelClient) {
  aiBriefingModelClient = client;
}

export async function generateDailyBriefing(
  userInput: string,
  newsItems: NewsItem[],
  marketData: MarketAssetQuote[],
  userPreferences: AIBriefingUserPreferences,
): Promise<AIDailyBriefing> {
  return aiBriefingModelClient.generate({ userInput, newsItems, marketData, userPreferences });
}

export function createAIBriefingPrompt({
  userInput,
  newsItems,
  marketData,
  userPreferences,
}: AIBriefingRequest) {
  return {
    system:
      "You are NEXUS Intel, a concise personal intelligence analyst. Generate a structured daily briefing with actionable priorities.",
    user: JSON.stringify(
      {
        instruction: "Generate greeting, executive summary, world situation, geopolitical risk, market snapshot, crypto watch, AI/tech signals, personal priority recommendation, and action list.",
        userInput,
        newsItems,
        marketData,
        userPreferences,
      },
      null,
      2,
    ),
  };
}

function buildMockDailyBriefing(
  userInput: string,
  newsItems: NewsItem[],
  marketData: MarketAssetQuote[],
  userPreferences: AIBriefingUserPreferences,
): AIDailyBriefing {
  if (!isMorningCommand(userInput)) {
    return {
      greeting: "Command received.",
      executiveSummary: "NEXUS is waiting for the morning briefing phrase before generating the daily intelligence stack.",
      worldSituation: "No world situation briefing has been generated for this command.",
      geopoliticalRisk: "No geopolitical risk briefing has been generated for this command.",
      marketSnapshot: "No market snapshot briefing has been generated for this command.",
      cryptoWatch: "No crypto watch briefing has been generated for this command.",
      aiTechSignals: "No AI/tech briefing has been generated for this command.",
      personalPriorityRecommendation: "No personal priority recommendation has been generated for this command.",
      actionListForTheDay: [],
    };
  }

  const sortedStories = [...newsItems].sort((a, b) => b.importanceScore - a.importanceScore);
  const worldStories = sortedStories.filter((story) => story.category === "world");
  const geopoliticalStories = sortedStories.filter((story) => story.category === "geopolitics");
  const aiTechStories = sortedStories.filter((story) => story.category === "ai-tech");
  const strongestAsset = [...marketData].sort((a, b) => b.changePercent - a.changePercent)[0];
  const weakestAsset = [...marketData].sort((a, b) => a.changePercent - b.changePercent)[0];
  const cryptoAssets = marketData.filter((asset) => asset.category === "Crypto");
  const priority = userPreferences.priorities?.[0];
  const riskLevel = getAggregateRiskLevel(sortedStories);

  return {
    greeting: userPreferences.localGreeting ?? "Good morning, Ram.",
    executiveSummary: buildExecutiveSummary(sortedStories, strongestAsset, weakestAsset, riskLevel),
    worldSituation: buildWorldSituation(worldStories, sortedStories),
    geopoliticalRisk: buildGeopoliticalRisk(geopoliticalStories, userPreferences),
    marketSnapshot: buildMarketSnapshot(strongestAsset, weakestAsset),
    cryptoWatch: buildCryptoWatch(cryptoAssets),
    aiTechSignals: buildAiTechSignals(aiTechStories),
    personalPriorityRecommendation: buildPriorityRecommendation(priority, userPreferences),
    actionListForTheDay: buildActionList(userPreferences, riskLevel),
  };
}

function isMorningCommand(userInput: string) {
  return Boolean(userInput.trim());
}

function getAggregateRiskLevel(newsItems: NewsItem[]): NewsRiskLevel {
  const riskRank: Record<NewsRiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const highestRisk = newsItems.reduce<NewsRiskLevel>(
    (highest, item) => (riskRank[item.riskLevel] > riskRank[highest] ? item.riskLevel : highest),
    "low",
  );

  return highestRisk;
}

function buildExecutiveSummary(
  newsItems: NewsItem[],
  strongestAsset: MarketAssetQuote | undefined,
  weakestAsset: MarketAssetQuote | undefined,
  riskLevel: NewsRiskLevel,
) {
  const leadStory = newsItems[0];
  const assetRead =
    strongestAsset && weakestAsset
      ? `${strongestAsset.name} leads at ${formatSigned(strongestAsset.changePercent)}, while ${weakestAsset.name} is the weakest read at ${formatSigned(weakestAsset.changePercent)}.`
      : "Market data is unavailable in the current feed.";

  return [
    `The morning risk posture is ${riskLevel}.`,
    leadStory ? `${leadStory.title} is the top intelligence item because ${leadStory.whyItMatters.toLowerCase()}` : "",
    assetRead,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildWorldSituation(worldStories: NewsItem[], fallbackStories: NewsItem[]) {
  const stories = worldStories.length ? worldStories : fallbackStories.slice(0, 2);

  return stories
    .map((story) => `${story.source}: ${story.summary} ${story.marketImpact}`)
    .join(" ");
}

function buildGeopoliticalRisk(stories: NewsItem[], userPreferences: AIBriefingUserPreferences) {
  const preferredRegions = userPreferences.preferredRegions.join(", ");
  const leadRisk = stories[0];
  const riskText = leadRisk
    ? `${leadRisk.title}: ${leadRisk.whyItMatters}`
    : "Geopolitical risk is present but no dedicated regional story is currently above the importance threshold.";

  return `${riskText} Preferred regional watch areas: ${preferredRegions}.`;
}

function buildMarketSnapshot(strongestAsset: MarketAssetQuote | undefined, weakestAsset: MarketAssetQuote | undefined) {
  if (!strongestAsset || !weakestAsset) {
    return "Market snapshot unavailable until the market data service returns assets.";
  }

  return `${strongestAsset.name} is the positive signal at ${formatSigned(strongestAsset.changePercent)}. ${weakestAsset.name} is the pressure point at ${formatSigned(weakestAsset.changePercent)}. Keep liquidity and positioning on screen before adding risk.`;
}

function buildCryptoWatch(cryptoAssets: MarketAssetQuote[]) {
  if (!cryptoAssets.length) {
    return "Crypto watch unavailable until crypto assets are present in the market data feed.";
  }

  const leader = [...cryptoAssets].sort((a, b) => b.changePercent - a.changePercent)[0];
  const laggard = [...cryptoAssets].sort((a, b) => a.changePercent - b.changePercent)[0];

  if (cryptoAssets.some((asset) => asset.changeAvailable === false)) {
    return cryptoAssets
      .map((asset) => `${asset.symbol}: ${formatUsd(asset.price)}, live ${asset.source ?? "crypto"} spot price. 24h change unavailable.`)
      .join(" ");
  }

  return `${leader.name} leads crypto at ${formatSigned(leader.changePercent)}. ${laggard.name} is the relative laggard at ${formatSigned(laggard.changePercent)}. Spot-led strength is constructive, but macro dollar pressure remains the key risk.`;
}

function buildAiTechSignals(aiTechStories: NewsItem[]) {
  const leadStory = aiTechStories[0];

  if (!leadStory) {
    return "AI/tech signal remains focused on inference infrastructure, agent workflows, security controls, and enterprise adoption.";
  }

  return `${leadStory.title}. ${leadStory.summary} ${leadStory.marketImpact}`;
}

function buildPriorityRecommendation(
  priority: PersonalPriorityMemory | undefined,
  userPreferences: AIBriefingUserPreferences,
) {
  if (!priority) {
    return `Use a ${userPreferences.riskTolerance} operating posture and select one high-leverage task before opening new research loops.`;
  }

  return `${priority.title} is the priority. ${priority.nextAction} Protect the first deep-work block before reacting to markets or headlines.`;
}

function buildActionList(userPreferences: AIBriefingUserPreferences, riskLevel: NewsRiskLevel) {
  const actions = userPreferences.suggestedActions?.length
    ? userPreferences.suggestedActions
    : [
        "Review the top intelligence item and translate it into one portfolio or work decision.",
        "Check market leaders, laggards, and liquidity before adding risk.",
        "Complete the highest-energy personal priority before midday.",
      ];

  if (riskLevel === "critical" || riskLevel === "high") {
    return ["Keep position sizing conservative until the risk picture clears.", ...actions].slice(0, 5);
  }

  return actions.slice(0, 5);
}

function formatUsd(value: number) {
  const useNoDecimals = value >= 1000;

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: useNoDecimals ? 0 : 2,
    minimumFractionDigits: useNoDecimals ? 0 : 2,
    style: "currency",
  }).format(value);
}
