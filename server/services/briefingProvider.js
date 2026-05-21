import { cryptoRadar, priorities, techSignals } from "../data/mockData.js";
import { getCryptoData } from "./cryptoProvider.js";
import { getMarkets } from "./marketProvider.js";
import { getNews } from "./newsProvider.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 25_000;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const sectionTitles = {
  greeting: "Greeting",
  executiveSummary: "Executive Summary",
  worldSituation: "World Situation",
  geopoliticalRisk: "Geopolitical Risk",
  marketSnapshot: "Market Snapshot",
  cryptoWatch: "Crypto Watch",
  aiTechSignals: "AI & Tech Signals",
  personalPriorityRecommendation: "Personal Priority Recommendation",
  actionListForTheDay: "Action List For The Day",
};

export async function generateBriefing({ command = "Good morning", mode = "standard" }) {
  const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalized !== "good morning") {
    throw new Error("Unsupported briefing command.");
  }

  const context = await gatherBriefingContext();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      data: buildFallbackBriefing({ context, mode, reason: "OPENAI_API_KEY is not configured." }),
      meta: {
        error: "OPENAI_API_KEY is not configured.",
        fallback: true,
        source: "local",
      },
    };
  }

  try {
    const aiBriefing = await requestOpenAIBriefing({ apiKey, context, mode });
    return {
      data: mapAiBriefingToUiBriefing(aiBriefing, mode),
      meta: {
        fallback: false,
        source: "openai",
      },
    };
  } catch (error) {
    console.error("OpenAI briefing generation failed:", error instanceof Error ? error.message : "Unknown OpenAI error.");
    return {
      data: buildFallbackBriefing({ context, mode, reason: "OpenAI generation failed." }),
      meta: {
        error: error instanceof Error ? error.message : "OpenAI generation failed.",
        fallback: true,
        source: "local",
      },
    };
  }
}

async function gatherBriefingContext() {
  const [cryptoEnvelope, marketsEnvelope, newsEnvelope] = await Promise.all([getCryptoData(), getMarkets(), getNews()]);
  const crypto = unwrapEnvelope(cryptoEnvelope);
  const markets = unwrapEnvelope(marketsEnvelope);
  const news = unwrapEnvelope(newsEnvelope);

  return {
    crypto,
    markets,
    news,
    personalPriorities: priorities,
    generatedAt: new Date().toISOString(),
  };
}

async function requestOpenAIBriefing({ apiKey, context, mode }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content:
              "You are NEXUS Intel, a concise personal intelligence analyst. Produce a grounded daily briefing from the supplied live data only. Do not invent prices, articles, sources, or events. If data is thin, say so plainly. Keep the tone premium, calm, and action-oriented.",
          },
          {
            role: "user",
            content: JSON.stringify(buildPromptPayload(context, mode)),
          },
        ],
        max_output_tokens: mode === "deep" ? 1800 : mode === "quick" ? 900 : 1300,
        model: OPENAI_MODEL,
        text: {
          format: {
            name: "nexus_daily_briefing",
            schema: briefingJsonSchema,
            strict: true,
            type: "json_schema",
          },
        },
      }),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI responded with ${response.status}`);
    }

    const payload = await response.json();
    const content = extractResponseText(payload);
    const parsed = JSON.parse(content);

    return validateAiBriefing(parsed);
  } finally {
    clearTimeout(timeout);
  }
}

function buildPromptPayload(context, mode) {
  const marketAssets = context.markets.assets ?? [];
  const cryptoAssets = context.crypto.assets ?? [];
  const newsItems = context.news.newsItems ?? [];

  return {
    instruction: "Create a NEXUS Daily Briefing in structured JSON.",
    mode,
    requiredSections: Object.values(sectionTitles),
    dataFreshness: {
      generatedAt: context.generatedAt,
      marketSources: uniqueValues(marketAssets.map((asset) => asset.source)),
      cryptoSources: uniqueValues(cryptoAssets.map((asset) => asset.source)),
      newsSources: uniqueValues(newsItems.map((item) => item.sourceType)),
    },
    markets: marketAssets.map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      value: asset.value,
      change: asset.change,
      category: asset.category,
      note: asset.note,
      source: asset.source,
      proxySymbol: asset.proxySymbol,
    })),
    crypto: cryptoAssets.map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      value: asset.value,
      change: asset.change,
      note: asset.note,
      source: asset.source,
    })),
    news: newsItems.slice(0, mode === "quick" ? 8 : 16).map((item) => ({
      title: item.title,
      source: item.source,
      category: item.category,
      publishedAt: item.publishedAt,
      importanceScore: item.importanceScore,
      riskLevel: item.riskLevel,
      summary: item.summary,
      whyItMatters: item.whyItMatters,
      marketImpact: item.marketImpact,
    })),
    personalPriorities: context.personalPriorities.map((priority) => ({
      title: priority.title,
      focus: priority.focus,
      nextAction: priority.nextAction,
      due: priority.due,
    })),
    outputRules: [
      "Return only JSON matching the schema.",
      "Keep each section clear enough to render as a dashboard bullet.",
      "Action list must contain practical actions for today.",
      "Mention live proxy symbols when discussing SPX, NDX, XAU, or WTI if relevant.",
    ],
  };
}

const briefingJsonSchema = {
  additionalProperties: false,
  properties: {
    actionListForTheDay: {
      items: { type: "string" },
      type: "array",
    },
    aiTechSignals: { type: "string" },
    cryptoWatch: { type: "string" },
    executiveSummary: { type: "string" },
    geopoliticalRisk: { type: "string" },
    greeting: { type: "string" },
    headline: { type: "string" },
    marketSnapshot: { type: "string" },
    personalPriorityRecommendation: { type: "string" },
    worldSituation: { type: "string" },
  },
  required: [
    "headline",
    "greeting",
    "executiveSummary",
    "worldSituation",
    "geopoliticalRisk",
    "marketSnapshot",
    "cryptoWatch",
    "aiTechSignals",
    "personalPriorityRecommendation",
    "actionListForTheDay",
  ],
  type: "object",
};

function validateAiBriefing(value) {
  const requiredStringKeys = [
    "headline",
    "greeting",
    "executiveSummary",
    "worldSituation",
    "geopoliticalRisk",
    "marketSnapshot",
    "cryptoWatch",
    "aiTechSignals",
    "personalPriorityRecommendation",
  ];

  for (const key of requiredStringKeys) {
    if (typeof value?.[key] !== "string" || !value[key].trim()) {
      throw new Error(`OpenAI briefing response missing ${key}.`);
    }
  }

  if (!Array.isArray(value.actionListForTheDay) || !value.actionListForTheDay.every((item) => typeof item === "string" && item.trim())) {
    throw new Error("OpenAI briefing response missing action list.");
  }

  return {
    ...value,
    actionListForTheDay: value.actionListForTheDay.slice(0, 6),
  };
}

function mapAiBriefingToUiBriefing(briefing, mode) {
  const sections = [
    { title: sectionTitles.greeting, items: [briefing.greeting] },
    { title: sectionTitles.executiveSummary, items: [briefing.executiveSummary] },
    { title: sectionTitles.worldSituation, items: [briefing.worldSituation] },
    { title: sectionTitles.geopoliticalRisk, items: [briefing.geopoliticalRisk] },
    { title: sectionTitles.marketSnapshot, items: [briefing.marketSnapshot] },
    { title: sectionTitles.cryptoWatch, items: [briefing.cryptoWatch] },
    { title: sectionTitles.aiTechSignals, items: [briefing.aiTechSignals] },
    { title: sectionTitles.personalPriorityRecommendation, items: [briefing.personalPriorityRecommendation] },
    { title: sectionTitles.actionListForTheDay, items: briefing.actionListForTheDay },
  ];

  return {
    mode,
    generatedAt: formatTime(),
    headline: briefing.headline,
    sections: mode === "quick" ? sections.slice(0, 5) : sections,
  };
}

function buildFallbackBriefing({ context, mode, reason }) {
  if (reason) {
    console.error("Using local briefing fallback:", reason);
  }

  const marketAssets = context.markets.assets ?? [];
  const cryptoAssets = context.crypto.assets ?? [];
  const newsItems = context.news.newsItems ?? [];
  const strongest = [...marketAssets].sort((a, b) => b.change - a.change)[0];
  const weakest = [...marketAssets].sort((a, b) => a.change - b.change)[0];
  const topStory = [...newsItems].sort((a, b) => b.importanceScore - a.importanceScore)[0];
  const worldStory = newsItems.find((item) => item.category === "world") ?? topStory;
  const geoStory = newsItems.find((item) => item.category === "geopolitics") ?? topStory;
  const aiStory = newsItems.find((item) => item.category === "ai-tech") ?? topStory;
  const btc = cryptoAssets.find((asset) => asset.symbol === "BTC") ?? cryptoAssets[0];
  const eth = cryptoAssets.find((asset) => asset.symbol === "ETH") ?? cryptoAssets[1];
  const sol = cryptoAssets.find((asset) => asset.symbol === "SOL") ?? cryptoAssets[2];
  const priority = context.personalPriorities[0];
  const fallback = {
    actionListForTheDay: [
      "Review the top live RSS headlines before making market decisions.",
      "Watch live proxy market direction across SPY, QQQ, GLD, and USO.",
      "Keep crypto position sizing disciplined while BTC, ETH, and SOL signals update.",
      priority ? priority.nextAction : "Protect the first deep-work block before opening new research loops.",
    ],
    aiTechSignals: aiStory
      ? `${aiStory.source}: ${aiStory.summary} ${aiStory.marketImpact}`
      : techSignals.slice(0, 2).map((signal) => `${signal.label}: ${signal.detail}`).join(" "),
    cryptoWatch: [btc, eth, sol]
      .filter(Boolean)
      .map((asset) => `${asset.symbol} is at ${asset.value} (${formatSigned(asset.change)}). ${asset.note}`)
      .join(" "),
    executiveSummary:
      topStory && strongest && weakest
        ? `${topStory.title} is the highest-weight headline. ${strongest.name} leads at ${formatSigned(strongest.change)}, while ${weakest.name} is the weakest cross-asset read at ${formatSigned(weakest.change)}.`
        : "NEXUS has live feeds online, but the briefing fallback could not identify a complete cross-asset signal set.",
    geopoliticalRisk: geoStory ? `${geoStory.source}: ${geoStory.whyItMatters} ${geoStory.marketImpact}` : "Geopolitical risk should be monitored through energy, shipping, and defense channels.",
    greeting: "Good morning. NEXUS Intel is online and your daily briefing is ready.",
    headline: "Morning signal: live feeds are online; keep risk disciplined while the news and market picture updates.",
    marketSnapshot:
      strongest && weakest
        ? `${strongest.name} is the positive signal at ${formatSigned(strongest.change)}. ${weakest.name} is the pressure point at ${formatSigned(weakest.change)}. Proxy data remains the live market lens.`
        : "Market data is available through the backend, but no complete strongest or weakest signal was identified.",
    personalPriorityRecommendation: priority
      ? `${priority.title}: ${priority.nextAction} Keep this ahead of reactive headline scanning.`
      : "Protect one focused output before reacting to markets or news.",
    worldSituation: worldStory ? `${worldStory.source}: ${worldStory.summary} ${worldStory.whyItMatters}` : "World news is available through live RSS feeds, with local fallback ready if feeds degrade.",
  };

  return mapAiBriefingToUiBriefing(fallback, mode);
}

function unwrapEnvelope(envelope) {
  return envelope?.data ?? envelope;
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  for (const output of payload?.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not include output text.");
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatSigned(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(2)}%`;
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
