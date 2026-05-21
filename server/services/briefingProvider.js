import { cryptoRadar, techSignals } from "../data/mockData.js";
import { getCryptoData } from "./cryptoProvider.js";
import { getMarkets } from "./marketProvider.js";
import { getNews } from "./newsProvider.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 25_000;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const NO_PERSONAL_DATA_MESSAGE = "No personal calendar/task data connected yet. Focus on review, planning, and execution discipline.";

const briefingWhyItMattersByCategory = {
  world: "This changes the macro backdrop that influences rates, trade flows, policy risk, and cross-asset positioning.",
  geopolitics: "This can affect security posture, supply chains, energy routes, defense demand, and regional risk premiums.",
  markets: "This can move rate expectations, dollar liquidity, commodities, and equity risk appetite.",
  crypto: "This can influence liquidity, risk appetite, and the relative bid for digital assets.",
  "ai-tech": "This can affect AI infrastructure demand, chip supply chains, cybersecurity budgets, and platform competition.",
};

const briefingMarketImpactByCategory = {
  world: "Watch rates, the dollar, energy, and defensive assets for second-order moves.",
  geopolitics: "Energy, shipping, defense tech, semiconductors, and insurance costs are most exposed.",
  markets: "Index breadth, commodities, treasury yields, and USD-sensitive assets should react first.",
  crypto: "Crypto beta can strengthen when liquidity improves and weaken when dollar stress rises.",
  "ai-tech": "AI infrastructure, semiconductors, cloud, networking, power, and security names are the likely transmission channels.",
};

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
  const feedMeta = {
    crypto: cryptoEnvelope?.meta ?? { fallback: true, source: "mock" },
    markets: marketsEnvelope?.meta ?? { fallback: true, source: "mock" },
    news: newsEnvelope?.meta ?? { fallback: true, source: "mock" },
  };

  return {
    crypto,
    feedMeta,
    markets,
    news: {
      ...news,
      newsItems: rankStories(news.newsItems ?? []),
    },
    personalPriorities: [],
    userPreferences: {},
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
              "You are NEXUS Intel, a concise personal intelligence analyst. Produce a grounded daily briefing from the supplied live data only. Do not invent prices, articles, sources, personal tasks, calendar events, deadlines, meetings, memos, calls, or user obligations. If data is thin, say so plainly. Write direct useful intelligence with clear why-it-matters and what-to-watch-today language. Avoid buzzwords.",
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

    return validateAiBriefing(parsed, context);
  } finally {
    clearTimeout(timeout);
  }
}

function buildPromptPayload(context, mode) {
  const marketAssets = context.markets.assets ?? [];
  const cryptoAssets = context.crypto.assets ?? [];
  const newsItems = selectBriefingStories(context.news.newsItems ?? [], mode);
  const feedQuality = getFeedQuality(context);
  const personalPriorities = context.personalPriorities ?? [];

  return {
    instruction: "Create a NEXUS Daily Briefing in structured JSON. Prioritize high-impact stories and ignore low-quality appointment/personnel/company fluff unless there are not enough better stories.",
    mode,
    requiredSections: Object.values(sectionTitles),
    classificationRules: {
      markets: "Company stock moves, Walmart or other retailer stock/earnings/news, inflation, central banks, oil, dollar, stocks, economy, and treasury stories belong in Market Snapshot or Executive Summary, not World Situation.",
      geopolitics: "War, sanctions, military, diplomacy, border, security, election conflict, oil conflict, Iran, Russia, Ukraine, or regional conflict belong in Geopolitical Risk.",
      aiTech: "Artificial intelligence, AI, chips, semiconductors, cybersecurity, OpenAI, and Nvidia belong in AI & Tech Signals.",
      world: "Broad global policy, elections, conflict, and trade with no direct market/security/AI angle belong in World Situation.",
    },
    dataFreshness: {
      generatedAt: context.generatedAt,
      confidenceDataQuality: feedQuality,
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
    rankedNews: newsItems.map((item, index) => ({
      rank: index + 1,
      title: item.title,
      source: item.source,
      url: item.url,
      category: item.category,
      publishedAt: item.publishedAt,
      importanceScore: item.importanceScore,
      riskLevel: item.riskLevel,
      summary: item.summary,
      whyItMatters: item.whyItMatters,
      marketImpact: item.marketImpact,
      priorityReason: getStoryPriorityReason(item),
    })),
    sourceLinks: newsItems.slice(0, 10).map((item) => ({
      title: item.title,
      source: item.source,
      url: item.url,
      category: item.category,
    })),
    personalDataPolicy: {
      connected: personalPriorities.length > 0,
      fallbackRecommendation: NO_PERSONAL_DATA_MESSAGE,
      rule: "Do not invent personal tasks, calendar events, deadlines, meetings, memos, or reminders. If no personal priority data is supplied, use the fallback recommendation exactly.",
    },
    personalPriorities: personalPriorities.map((priority) => ({
      title: priority.title,
      focus: priority.focus,
      nextAction: priority.nextAction,
      due: priority.due,
    })),
    outputRules: [
      "Return only JSON matching the schema.",
      "Include source names inline for factual claims, for example '(CNBC Markets)' or '(BBC World)'. Do not put raw URLs into every sentence; URLs are supplied for traceability.",
      "Do not cite or summarize low-impact appointment/personnel news unless no higher-impact stories are available.",
      "The executive summary should be direct: what happened, why it matters, and what to watch today.",
      "Personal Priority Recommendation must use the exact fallback text if personalDataPolicy.connected is false.",
      "Keep each section clear enough to render as a dashboard bullet.",
      "Action list must contain practical actions for today.",
      "Mention live proxy symbols when discussing SPX, NDX, XAU, or WTI if relevant.",
      "Include one 'Confidence / Data Quality: ...' sentence in the Executive Summary.",
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

function validateAiBriefing(value, context) {
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

  const feedQuality = getFeedQuality(context);
  const executiveSummary = ensureDataQualityLine(value.executiveSummary, feedQuality);
  const personalPriorityRecommendation = context.personalPriorities?.length
    ? value.personalPriorityRecommendation
    : NO_PERSONAL_DATA_MESSAGE;

  return {
    ...value,
    executiveSummary,
    actionListForTheDay: value.actionListForTheDay.slice(0, 6),
    personalPriorityRecommendation,
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
  const newsItems = selectBriefingStories(context.news.newsItems ?? [], mode);
  const strongest = [...marketAssets].sort((a, b) => b.change - a.change)[0];
  const weakest = [...marketAssets].sort((a, b) => a.change - b.change)[0];
  const topStory = newsItems[0];
  const worldStory = newsItems.find((item) => item.category === "world") ?? topStory;
  const geoStory = newsItems.find((item) => item.category === "geopolitics") ?? topStory;
  const marketStory = newsItems.find((item) => item.category === "markets") ?? topStory;
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
      "Use the briefing to identify what changed, why it matters, and what to watch today.",
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
        ? `${topStory.title} (${topStory.source}) is the highest-weight headline. ${strongest.name} leads at ${formatSigned(strongest.change)}, while ${weakest.name} is the weakest cross-asset read at ${formatSigned(weakest.change)}. Confidence / Data Quality: Low because OpenAI fallback was used.`
        : "NEXUS has live feeds online, but the briefing fallback could not identify a complete cross-asset signal set.",
    geopoliticalRisk: geoStory
      ? `${geoStory.title} (${geoStory.source}): ${geoStory.summary} ${geoStory.whyItMatters} ${geoStory.marketImpact}`
      : "Geopolitical risk should be monitored through energy, shipping, and defense channels.",
    greeting: "Good morning. NEXUS Intel is online and your daily briefing is ready.",
    headline: "Morning signal: live feeds are online; keep risk disciplined while the news and market picture updates.",
    marketSnapshot:
      strongest && weakest
        ? `${strongest.name} is the positive signal at ${formatSigned(strongest.change)}. ${weakest.name} is the pressure point at ${formatSigned(weakest.change)}. ${marketStory ? `${marketStory.title} (${marketStory.source}) is the highest-ranked market story. ` : ""}Proxy data remains the live market lens.`
        : "Market data is available through the backend, but no complete strongest or weakest signal was identified.",
    personalPriorityRecommendation: priority ? `${priority.title}: ${priority.nextAction}` : NO_PERSONAL_DATA_MESSAGE,
    worldSituation: worldStory
      ? `${worldStory.title} (${worldStory.source}): ${worldStory.summary} ${worldStory.whyItMatters}`
      : "World news is available through live RSS feeds, with local fallback ready if feeds degrade.",
  };

  return mapAiBriefingToUiBriefing(fallback, mode);
}

function unwrapEnvelope(envelope) {
  return envelope?.data ?? envelope;
}

function selectBriefingStories(newsItems, mode) {
  const ranked = rankStories(newsItems);
  const highQuality = ranked.filter((item) => !isLowImpactStory(item));
  const targetCount = mode === "quick" ? 8 : mode === "deep" ? 24 : 18;
  const minimumUsefulCount = Math.min(6, targetCount);
  const pool = highQuality.length >= minimumUsefulCount ? highQuality : ranked;
  const selected = pool.slice(0, targetCount);
  const requiredCategories = ["geopolitics", "markets", "ai-tech", "world"];

  for (const category of requiredCategories) {
    const alreadySelected = selected.some((story) => story.category === category);
    if (alreadySelected) continue;

    const candidate = pool.find((story) => story.category === category && !selected.some((selectedStory) => selectedStory.id === story.id));
    if (!candidate) continue;

    if (selected.length < targetCount) {
      selected.push(candidate);
      continue;
    }

    const replaceIndex = findReplaceableStoryIndex(selected, requiredCategories);
    selected[replaceIndex] = candidate;
  }

  return selected.sort((a, b) => getBriefingStoryScore(b) - getBriefingStoryScore(a)).slice(0, targetCount);
}

function findReplaceableStoryIndex(stories, requiredCategories) {
  const index = stories.findLastIndex((story) => !requiredCategories.includes(story.category));

  return index === -1 ? stories.length - 1 : index;
}

function rankStories(newsItems) {
  return [...newsItems]
    .map((item) => {
      const category = classifyBriefingStory(item);

      return {
        ...item,
        category,
        importanceScore: Math.max(item.importanceScore ?? 60, getBriefingStoryScore(item)),
        marketImpact: briefingMarketImpactByCategory[category] ?? item.marketImpact,
        priorityScore: getBriefingStoryScore(item),
        whyItMatters: briefingWhyItMattersByCategory[category] ?? item.whyItMatters,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || b.importanceScore - a.importanceScore)
    .map(({ priorityScore, ...item }) => item);
}

function classifyBriefingStory(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();

  if (/\b(walmart|target|amazon|apple|microsoft|tesla|meta|alphabet|google|ibm|oracle|salesforce|netflix)\b/.test(text) &&
      /\b(stock|stocks|shares|earnings|revenue|profit|sales|guidance|cash flow|market value|turnaround|rises|falls|jumps|drops)\b/.test(text)) {
    return "markets";
  }
  if (/\b(war|sanction|sanctions|military|diplomacy|border|security|conflict|missile|defense|oil conflict|iran|ukraine|russia|israel|election|elections)\b/.test(text)) {
    return "geopolitics";
  }
  if (/\b(artificial intelligence|openai|nvidia|semiconductor|semiconductors|chip|chips|cybersecurity|gpu)\b/.test(text)) {
    return "ai-tech";
  }
  if (/\b(inflation|central bank|oil|dollar|stocks|stock|shares|economy|treasury|earnings|revenue|wall street|yield|yields)\b/.test(text)) {
    return "markets";
  }
  if (/\b(policy|election|elections|trade|global|conflict)\b/.test(text)) {
    return "world";
  }

  return item.category ?? "world";
}

function getBriefingStoryScore(item) {
  const category = classifyBriefingStory(item);
  const text = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();
  const categoryWeight = {
    geopolitics: 40,
    markets: 34,
    "ai-tech": 28,
    world: 22,
    crypto: 18,
  }[category] ?? 18;
  const riskWeight = {
    critical: 20,
    high: 15,
    medium: 8,
    low: 2,
  }[item.riskLevel] ?? 2;
  const importance = Math.round((item.importanceScore ?? 60) / 4);
  const impactBoost =
    (/\b(war|sanction|military|security|conflict|oil|iran|ukraine|russia)\b/.test(text) ? 12 : 0) +
    (/\b(walmart|stocks|shares|earnings|inflation|central bank|treasury|dollar|economy)\b/.test(text) ? 10 : 0) +
    (/\b(artificial intelligence|openai|nvidia|chip|semiconductor|cybersecurity)\b/.test(text) ? 8 : 0);
  const lowImpactPenalty = isLowImpactStory(item) ? 30 : 0;

  return categoryWeight + riskWeight + importance + impactBoost - lowImpactPenalty;
}

function isLowImpactStory(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.source ?? ""}`.toLowerCase();

  return /\b(appoints|appointment|joins|hiring|promotion|board|chief people|executive appointment)\b/.test(text) ||
    /\b(world cup|football|soccer|nba|nfl|cricket|tennis|match|squad|coach|player|goalkeeper)\b/.test(text) ||
    /\b(ask me anything|review robot vacuum|robot vacuums|product review|best switch|protective case|cases|tested several|review)\b/.test(text) ||
    /\b(smart glasses|gaming|movies|usb-c|refurbished|snag|deal|deals|coupon)\b/.test(text) ||
    /\b(how to get|what is an? |what is the |personal loan|unsecured loan|apr on a personal loan|earnings transcript)\b/.test(text);
}

function getStoryPriorityReason(item) {
  const category = classifyBriefingStory(item);
  if (category === "geopolitics") return "Security/geopolitical impact ranked ahead of lower-impact headlines.";
  if (category === "markets") return "Market/economy impact ranked ahead of broad or low-impact headlines.";
  if (category === "ai-tech") return "AI/technology impact ranked after geopolitics and markets.";
  return "Broad world relevance.";
}

function getFeedQuality(context, openAiFallback = false) {
  if (openAiFallback) return "Low";

  const metas = [context.feedMeta?.crypto, context.feedMeta?.markets, context.feedMeta?.news].filter(Boolean);
  const fallbackCount = metas.filter((meta) => meta.fallback).length;

  if (fallbackCount === 0) return "High";
  if (fallbackCount === 1) return "Medium";
  return "Low";
}

function ensureDataQualityLine(text, feedQuality) {
  const dataQualityLine = `Confidence / Data Quality: ${feedQuality}.`;

  if (/Confidence\s*\/\s*Data Quality:/i.test(text)) {
    return text.replace(/Confidence\s*\/\s*Data Quality:\s*[^.]+\.?/i, dataQualityLine);
  }

  return `${text} ${dataQualityLine}`;
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
