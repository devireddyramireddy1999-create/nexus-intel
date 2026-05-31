import { techSignals } from "../data/mockData.js";
import { getCryptoData } from "./cryptoProvider.js";
import { buildNexusJudgment, formatNexusReadItems } from "./judgmentEngine.js";
import { getMarkets } from "./marketProvider.js";
import { getNews } from "./newsProvider.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 25_000;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const NO_PERSONAL_DATA_MESSAGE = "No personal calendar/task data connected yet. Focus on review, planning, and execution discipline.";
const LOW_DATA_QUALITY_MESSAGE = "Signal quality is limited; treat this brief as directional.";
const NO_MAJOR_WORLD_SHIFT_MESSAGE = "No major global regime shift detected; current risk is mostly market and headline-driven.";

const majorWorldSituationPattern =
  /\b(war|conflict|ceasefire|missile|attack|military|diplomacy|sanction|sanctions|border|security|election|elections|policy|tariff|trade|central bank|rates|inflation|energy|oil|shipping|strait|hormuz|supply chain|russia|ukraine|iran|israel|china|taiwan|federal reserve|treasury|dollar|recession|global economy|market shock|systemic risk)\b/i;
const majorAiTechWorldPattern =
  /\b(openai|nvidia|semiconductor|semiconductors|chip|chips|cybersecurity|data center|export control|export controls|ai regulation|artificial intelligence regulation|cloud infrastructure|power demand)\b/i;
const lowWorldRelevancePattern =
  /\b(startup application|application deadline|applications open|funding announcement|fundraise|seed round|series a|product launch|launches new|generic company|press release|company pr|appointment|appoints|hiring|promotion|human-interest|human interest|wearable|gadget|review|deal|coupon|world cup|football|soccer|nba|nfl|cricket)\b/i;

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
  nexusRead: "NEXUS Read",
  worldSituation: "World Situation",
  geopoliticalRisk: "Geopolitical Risk",
  marketSnapshot: "Market Snapshot",
  cryptoWatch: "Crypto Watch",
  aiTechSignals: "AI & Tech Signals",
  personalPriorityRecommendation: "Personal Priority Recommendation",
  actionListForTheDay: "Action List For The Day",
};

export async function generateBriefing({ command = "Good morning", localGreeting, mode = "standard" }) {
  const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();

  const context = await gatherBriefingContext({
    command,
    normalizedCommand: normalized,
    requiredGreeting: getGreetingForCommand(normalized, localGreeting),
  });
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
    const dataQuality = getFeedQuality(context);
    return {
      data: mapAiBriefingToUiBriefing(aiBriefing, mode, context.generatedAt, dataQuality),
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

async function gatherBriefingContext({ command, normalizedCommand, requiredGreeting }) {
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
    normalizedCommand,
    requiredGreeting,
    userInput: command,
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
              "You are NEXUS Intel, a concise personal intelligence analyst. Produce a grounded daily briefing from the supplied live data only. Do not invent prices, articles, sources, personal tasks, calendar events, deadlines, meetings, memos, calls, or user obligations. The greeting must exactly match the required greeting supplied in the prompt, such as Good morning, Ram. Never use Sir. Use exact market and crypto values supplied in the prompt. If crypto 24h change is unavailable, say it is unavailable and do not imply momentum from spot-only data. If signal quality is thin, say so plainly in user-facing language. Do not expose implementation details, connector mechanics, browser storage, endpoint mechanics, or code object names. Write direct useful intelligence with clear why-it-matters and what-to-watch-today language. Avoid buzzwords.",
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
  const requiredCryptoWatch = buildCryptoWatchText(context);
  const requiredMarketSnapshot = buildMarketProxySnapshotText(context);
  const tacticalWatchItems = buildTacticalActionList(context, newsItems);
  const nexusJudgment = buildBriefingJudgment(context, newsItems);
  const nexusReadItems = formatNexusReadItems(nexusJudgment);

  return {
    instruction: "Create a NEXUS Daily Briefing in structured JSON. Prioritize high-impact stories. Exclude appointment/personnel/company fluff, startup deadlines, product launches, generic PR, random funding items, and isolated human-interest stories from world/geopolitical context unless they are clearly market-moving or globally relevant.",
    mode,
    requiredSections: Object.values(sectionTitles),
    userInputContext: {
      originalInput: context.userInput,
      normalizedInput: context.normalizedCommand,
      requiredGreeting: context.requiredGreeting,
    },
    classificationRules: {
      markets: "Company stock moves, Walmart or other retailer stock/earnings/news, inflation, central banks, oil, dollar, stocks, economy, and treasury stories belong in Market Snapshot or Executive Summary, not World Situation.",
      geopolitics: "War, sanctions, military, diplomacy, border, security, election conflict, oil conflict, Iran, Russia, Ukraine, or regional conflict belong in Geopolitical Risk.",
      aiTech: "Artificial intelligence, AI, chips, semiconductors, cybersecurity, OpenAI, and Nvidia belong in AI & Tech Signals.",
      world: "World Situation is only for wars/conflict, geopolitical tension, elections/policy, sanctions, energy/shipping/security, central banks/rates/inflation, major economic risks, and major AI/tech market-moving developments. If no strong global item exists, say there is no major global regime shift.",
    },
    dataFreshness: {
      generatedAt: context.generatedAt,
      confidenceDataQuality: feedQuality,
      marketSources: uniqueValues(marketAssets.map((asset) => asset.source)),
      cryptoSources: uniqueValues(cryptoAssets.map((asset) => asset.source)),
      newsSources: uniqueValues(newsItems.map((item) => formatSourceTypeForPrompt(item.sourceType))),
    },
    exactOutputRequirements: {
      greeting: context.requiredGreeting,
      cryptoWatchMustInclude: requiredCryptoWatch,
      marketSnapshotMustInclude: requiredMarketSnapshot,
      nexusReadMustInclude: nexusReadItems,
      personalPriorityRecommendation: personalPriorities.length > 0 ? "Use supplied personal priority data only." : NO_PERSONAL_DATA_MESSAGE,
      tacticalWatchItems,
    },
    nexusJudgment,
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
      changeAvailable: asset.changeAvailable !== false,
      changeSource: asset.changeSource ?? "24h",
      note: asset.note,
      source: asset.source,
    })),
    rankedNews: newsItems.map((item, index) => ({
      rank: index + 1,
      title: item.title,
      source: item.source,
      coveredBy: item.coveredBy ?? [item.source].filter(Boolean),
      sourceCount: item.sourceCount ?? 1,
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
      coveredBy: item.coveredBy ?? [item.source].filter(Boolean),
      sourceCount: item.sourceCount ?? 1,
      url: item.url,
      category: item.category,
    })),
    personalDataPolicy: {
      connected: personalPriorities.length > 0,
      defaultRecommendation: NO_PERSONAL_DATA_MESSAGE,
      rule: "Do not invent personal tasks, calendar events, deadlines, meetings, memos, or reminders. If no personal priority data is supplied, use the default recommendation exactly.",
    },
    personalPriorities: personalPriorities.map((priority) => ({
      title: priority.title,
      focus: priority.focus,
      nextAction: priority.nextAction,
      due: priority.due,
    })),
    outputRules: [
      "Return only JSON matching the schema.",
      `Greeting must be exactly: "${context.requiredGreeting}"`,
      "Never use the word Sir in the greeting or elsewhere.",
      `Crypto Watch must include these exact live crypto readouts and availability notes: ${requiredCryptoWatch}`,
      `Market Snapshot must explicitly state these proxy mappings and exact values: ${requiredMarketSnapshot}`,
      "Include source names inline for factual claims, for example '(CNBC Markets)' or '(BBC World)'. Do not put raw URLs into every sentence; URLs are supplied for traceability.",
      "Treat rankedNews as deduplicated story clusters. Do not repeat the same title or story cluster across multiple news sections.",
      "Do not expose internal implementation wording or infrastructure terms in any user-facing sentence.",
      "Every news-driven sentence in World Situation, Geopolitical Risk, Market Snapshot, and AI & Tech Signals must include a source name near the claim.",
      "Do not cite or summarize low-impact appointment/personnel news unless no higher-impact stories are available.",
      `World Situation must include only major world-relevant topics. Exclude startup deadlines, small product launches, generic company PR, random funding announcements, and isolated human-interest stories. If there is no strong world signal, write exactly: "${NO_MAJOR_WORLD_SHIFT_MESSAGE}"`,
      "The executive summary should explain what matters most, whether markets are confirming or ignoring headline risk, and what to watch next.",
      `NEXUS Read must be a compact decision block using this deterministic judgment: ${nexusReadItems.join(" ")}`,
      "Personal Priority Recommendation must use the exact default text if personalDataPolicy.connected is false.",
      "Keep each section clear enough to render as a dashboard bullet.",
      "Action list must contain 3 to 5 tactical watch items for today, not generic productivity advice.",
      "If any crypto 24h change is unavailable, do not say to use 24h changes as a risk-temperature or momentum check.",
      "Mention live proxy symbols when discussing SPX, NDX, XAU, or WTI if relevant.",
      `Include one 'Confidence / Data Quality: ...' sentence in the Executive Summary. If quality is Low, use this exact wording after the label: ${LOW_DATA_QUALITY_MESSAGE}`,
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
    nexusRead: {
      items: { type: "string" },
      type: "array",
    },
    personalPriorityRecommendation: { type: "string" },
    worldSituation: { type: "string" },
  },
  required: [
    "headline",
    "greeting",
    "executiveSummary",
    "nexusRead",
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

  if (!Array.isArray(value.nexusRead) || !value.nexusRead.every((item) => typeof item === "string" && item.trim())) {
    throw new Error("OpenAI briefing response missing NEXUS Read.");
  }

  const feedQuality = getFeedQuality(context);
  const executiveSummary = sanitizeUserFacingText(ensureDataQualityLine(value.executiveSummary, feedQuality));
  const cryptoWatch = stripSirHonorific(mergeRequiredReadout(buildCryptoWatchText(context), value.cryptoWatch));
  const greeting = context.requiredGreeting ?? getGreetingForCommand(context.normalizedCommand);
  const marketSnapshot = stripSirHonorific(mergeRequiredReadout(buildMarketProxySnapshotText(context), value.marketSnapshot));
  const personalPriorityRecommendation = context.personalPriorities?.length
    ? sanitizeUserFacingText(value.personalPriorityRecommendation)
    : NO_PERSONAL_DATA_MESSAGE;
  const actionListForTheDay = buildTacticalActionList(context, value.actionListForTheDay).slice(0, 5).map(sanitizeUserFacingText);
  const nexusRead = formatNexusReadItems(buildBriefingJudgment(context)).map(sanitizeUserFacingText);

  return {
    ...value,
    actionListForTheDay,
    cryptoWatch: sanitizeUserFacingText(cryptoWatch),
    executiveSummary,
    greeting,
    headline: sanitizeUserFacingText(value.headline),
    geopoliticalRisk: sanitizeUserFacingText(value.geopoliticalRisk),
    aiTechSignals: sanitizeUserFacingText(value.aiTechSignals),
    marketSnapshot: sanitizeUserFacingText(marketSnapshot),
    nexusRead,
    personalPriorityRecommendation,
    worldSituation: buildWorldSituationText(context, value.worldSituation),
  };
}

function mapAiBriefingToUiBriefing(briefing, mode, generatedAt = new Date().toISOString(), dataQuality = "Low") {
  const displayDataQuality = getDataQualityDisplay(dataQuality);
  const sections = [
    { title: sectionTitles.greeting, items: [sanitizeUserFacingText(briefing.greeting)] },
    { title: sectionTitles.executiveSummary, items: [sanitizeUserFacingText(briefing.executiveSummary)] },
    { title: sectionTitles.nexusRead, items: briefing.nexusRead.map(sanitizeUserFacingText) },
    { title: sectionTitles.worldSituation, items: [sanitizeUserFacingText(briefing.worldSituation)] },
    { title: sectionTitles.geopoliticalRisk, items: [sanitizeUserFacingText(briefing.geopoliticalRisk)] },
    { title: sectionTitles.marketSnapshot, items: [sanitizeUserFacingText(briefing.marketSnapshot)] },
    { title: sectionTitles.cryptoWatch, items: [sanitizeUserFacingText(briefing.cryptoWatch)] },
    { title: sectionTitles.aiTechSignals, items: [sanitizeUserFacingText(briefing.aiTechSignals)] },
    { title: sectionTitles.personalPriorityRecommendation, items: [sanitizeUserFacingText(briefing.personalPriorityRecommendation)] },
    { title: sectionTitles.actionListForTheDay, items: briefing.actionListForTheDay.map(sanitizeUserFacingText) },
  ];

  return {
    dataQuality: displayDataQuality,
    mode,
    generatedAt,
    headline: sanitizeUserFacingText(briefing.headline),
    sections: mode === "quick" ? sections.slice(0, 5) : sections,
  };
}

function buildFallbackBriefing({ context, mode, reason }) {
  if (reason) {
    console.error("Using local briefing fallback:", reason);
  }

  const marketAssets = context.markets.assets ?? [];
  const newsItems = selectBriefingStories(context.news.newsItems ?? [], mode);
  const strongest = [...marketAssets].sort((a, b) => b.change - a.change)[0];
  const weakest = [...marketAssets].sort((a, b) => a.change - b.change)[0];
  const topStory = newsItems[0];
  const worldStory = selectStrongWorldSituationStory(newsItems);
  const geoStory = newsItems.find((item) => item.category === "geopolitics") ?? topStory;
  const marketStory = newsItems.find((item) => item.category === "markets") ?? topStory;
  const aiStory = newsItems.find((item) => item.category === "ai-tech") ?? topStory;
  const priority = context.personalPriorities[0];
  const nexusRead = formatNexusReadItems(buildBriefingJudgment(context, newsItems));
  const fallback = {
    actionListForTheDay: buildTacticalActionList(context, newsItems),
    aiTechSignals: aiStory
      ? `${aiStory.source}: ${aiStory.summary} ${aiStory.marketImpact}`
      : techSignals.slice(0, 2).map((signal) => `${signal.label}: ${signal.detail}`).join(" "),
    cryptoWatch: buildCryptoWatchText(context),
    executiveSummary: buildFallbackExecutiveSummary({ context, newsItems, strongest, weakest, topStory }),
    geopoliticalRisk: geoStory
      ? `${geoStory.title} (${geoStory.source}): ${geoStory.summary} ${geoStory.whyItMatters} ${geoStory.marketImpact}`
      : "Geopolitical risk should be monitored through energy, shipping, and defense channels.",
    greeting: context.requiredGreeting ?? getGreetingForCommand(context.normalizedCommand),
    headline: "Morning signal: live feeds are online; keep risk disciplined while the news and market picture updates.",
    marketSnapshot:
      strongest && weakest
        ? `${buildMarketProxySnapshotText(context)} ${strongest.name} is the positive signal at ${formatSigned(strongest.change)}. ${weakest.name} is the pressure point at ${formatSigned(weakest.change)}. ${marketStory ? `${marketStory.title} (${marketStory.source}) is the highest-ranked market story. ` : ""}Proxy data remains the live market lens.`
        : "Market data is available, but no complete strongest or weakest signal was identified.",
    nexusRead,
    personalPriorityRecommendation: priority ? `${priority.title}: ${priority.nextAction}` : NO_PERSONAL_DATA_MESSAGE,
    worldSituation: worldStory
      ? formatWorldSituationStory(worldStory)
      : NO_MAJOR_WORLD_SHIFT_MESSAGE,
  };

  return mapAiBriefingToUiBriefing(fallback, mode, context.generatedAt, getFeedQuality(context, true));
}

function unwrapEnvelope(envelope) {
  return envelope?.data ?? envelope;
}

function buildBriefingJudgment(context, newsItems = context.news.newsItems ?? []) {
  return buildNexusJudgment({
    cryptoAssets: context.crypto.assets ?? [],
    marketAssets: context.markets.assets ?? [],
    newsItems,
    riskSignals: context.news.riskSignals ?? [],
    stories: context.news.stories ?? [],
  });
}

function isBriefingIntent(normalizedCommand) {
  return ["", "good morning", "generate morning brief", "morning brief", "refresh brief"].includes(normalizedCommand);
}

function getGreetingForCommand(normalizedCommand, localGreeting) {
  const greeting = sanitizeGreeting(localGreeting);
  if (greeting) return greeting;

  return isBriefingIntent(normalizedCommand) ? "Good morning, Ram." : "Hello, Ram.";
}

function sanitizeGreeting(value) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!/^(Good morning|Good afternoon|Good evening), Ram\.$/.test(trimmed)) return "";

  return trimmed;
}

function buildCryptoWatchText(context) {
  const cryptoAssets = context.crypto.assets ?? [];
  const requiredSymbols = ["BTC", "ETH", "SOL"];

  return requiredSymbols
    .map((symbol) => {
      const asset = cryptoAssets.find((item) => item.symbol === symbol);
      if (!asset) return `${symbol}: unavailable.`;
      const source = asset.source ?? "crypto feed";

      if (asset.changeAvailable === false) {
        return `${symbol}: ${asset.value}, live ${source} spot price. 24h change unavailable.`;
      }

      return `${symbol}: ${asset.value} (${formatSigned(asset.change)} 24h, live ${source}).`;
    })
    .join(" ");
}

function buildMarketProxySnapshotText(context) {
  const marketAssets = context.markets.assets ?? [];
  const proxyLabels = [
    { proxySymbol: "SPY", symbol: "SPX" },
    { proxySymbol: "QQQ", symbol: "NDX" },
    { proxySymbol: "GLD", symbol: "XAU" },
    { proxySymbol: "USO", symbol: "WTI" },
  ];

  return proxyLabels
    .map(({ proxySymbol, symbol }) => {
      const asset = marketAssets.find((item) => item.symbol === symbol);
      if (!asset) return `${symbol} uses ${proxySymbol}: unavailable.`;
      if (asset.fallback) {
        return `${symbol} uses ${proxySymbol}: live proxy unavailable; showing latest saved ${symbol} ${asset.value} (${formatSigned(asset.change)}).`;
      }

      return `${symbol} uses ${proxySymbol}: ${proxySymbol} ${asset.value} (${formatSigned(asset.change)}).`;
    })
    .join(" ");
}

function buildTacticalActionList(context, newsOrActions = []) {
  const newsItems = Array.isArray(newsOrActions) && typeof newsOrActions[0] === "object"
    ? newsOrActions
    : selectBriefingStories(context.news.newsItems ?? [], "standard");
  const marketAssets = context.markets.assets ?? [];
  const spy = marketAssets.find((asset) => asset.symbol === "SPX");
  const qqq = marketAssets.find((asset) => asset.symbol === "NDX");
  const gld = marketAssets.find((asset) => asset.symbol === "XAU");
  const uso = marketAssets.find((asset) => asset.symbol === "WTI");
  const geoStory = newsItems.find((item) => item.category === "geopolitics");
  const marketStory = newsItems.find((item) => item.category === "markets");
  const aiStory = newsItems.find((item) => item.category === "ai-tech");
  const actions = [
    geoStory
      ? `Watch ${geoStory.title} (${geoStory.source}) for energy, shipping, and security spillover.`
      : "Watch geopolitical updates for sanctions, military, diplomacy, border, and energy-risk headlines.",
    spy && qqq
      ? `Track equity proxy direction: SPY ${spy.value} (${formatSigned(spy.change)}) and QQQ ${qqq.value} (${formatSigned(qqq.change)}).`
      : "Track SPY and QQQ proxy direction for broad risk appetite.",
    uso && gld
      ? `Track macro hedges: USO ${uso.value} (${formatSigned(uso.change)}) and GLD ${gld.value} (${formatSigned(gld.change)}).`
      : "Track USO and GLD proxy moves for oil and gold stress signals.",
    buildCryptoActionText(context),
    aiStory
      ? `Monitor ${aiStory.title} (${aiStory.source}) for AI/chip read-through.`
      : marketStory
        ? `Monitor ${marketStory.title} (${marketStory.source}) for market read-through.`
        : "Monitor the highest-ranked live headline for cross-asset read-through.",
  ];

  return actions.slice(0, 5);
}

function buildCryptoActionText(context) {
  const cryptoAssets = context.crypto.assets ?? [];
  const hasUnavailableChange = cryptoAssets.some((asset) => asset.changeAvailable === false);

  if (hasUnavailableChange) {
    return `${buildCryptoWatchText(context)} Use Coinbase spot prices as a live price check only; wait for CoinGecko 24h change before judging crypto momentum.`;
  }

  return `${buildCryptoWatchText(context)} Use those 24h changes as the crypto risk-temperature check.`;
}

function mergeRequiredReadout(requiredReadout, generatedText) {
  const text = typeof generatedText === "string" ? generatedText.trim() : "";

  if (!text) return requiredReadout;
  if (text.includes(requiredReadout)) return text;

  return `${requiredReadout} ${text}`;
}

function stripSirHonorific(text) {
  return typeof text === "string" ? text.replace(/\bSir\b[,.]?\s*/gi, "").trim() : text;
}

function sanitizeUserFacingText(text) {
  if (typeof text !== "string") return text;

  return stripSirHonorific(text)
    .replace(/\b(?:because\s+)?OpenAI fallback was used\.?/gi, LOW_DATA_QUALITY_MESSAGE)
    .replace(/\bOpenAI fallback\b/gi, "signal quality")
    .replace(/\bfallback\b/gi, "backup signal")
    .replace(/\bprovider\b/gi, "source")
    .replace(/\blocalStorage\b/gi, "saved app data")
    .replace(/\bapi\b/gi, "data feed")
    .replace(/\bmarket_chart\b/gi, "market history")
    .replace(/\bsnapshot object\b/gi, "saved comparison state")
    .replace(/\s+/g, " ")
    .trim();
}

function getDataQualityDisplay(dataQuality) {
  return dataQuality === "Low" ? LOW_DATA_QUALITY_MESSAGE : dataQuality;
}

function formatSourceTypeForPrompt(sourceType) {
  if (sourceType === "rss") return "live news feed";
  if (sourceType === "fallback") return "backup news feed";
  return sourceType ?? "news feed";
}

function buildWorldSituationText(context, generatedText) {
  const strongStory = selectStrongWorldSituationStory(context.news.newsItems ?? []);
  const cleanText = sanitizeUserFacingText(generatedText);

  if (!strongStory) return NO_MAJOR_WORLD_SHIFT_MESSAGE;
  if (!isStrongWorldSituationText(cleanText)) return formatWorldSituationStory(strongStory);

  return cleanText;
}

function formatWorldSituationStory(story) {
  const summary = story.summary ? `${story.summary}` : "This is the highest-relevance global signal in the current feed.";
  const why = story.whyItMatters ? ` ${story.whyItMatters}` : "";

  return sanitizeUserFacingText(`${story.title} (${story.source}) is the main global signal. ${summary}${why}`);
}

function selectStrongWorldSituationStory(newsItems) {
  return rankStories(newsItems).find(isStrongWorldSituationStory);
}

function isStrongWorldSituationStory(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.whyItMatters ?? ""} ${item.marketImpact ?? ""}`.toLowerCase();

  if (isLowImpactStory(item)) return false;
  if (lowWorldRelevancePattern.test(text) && !majorWorldSituationPattern.test(text) && !majorAiTechWorldPattern.test(text)) return false;

  return majorWorldSituationPattern.test(text) || majorAiTechWorldPattern.test(text);
}

function isStrongWorldSituationText(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  if (text.includes(NO_MAJOR_WORLD_SHIFT_MESSAGE)) return true;
  if (lowWorldRelevancePattern.test(text) && !majorWorldSituationPattern.test(text) && !majorAiTechWorldPattern.test(text)) return false;

  return majorWorldSituationPattern.test(text) || majorAiTechWorldPattern.test(text);
}

function buildFallbackExecutiveSummary({ context, newsItems, strongest, weakest, topStory }) {
  const leadStory = selectStrongWorldSituationStory(newsItems) ?? topStory;
  const lead = leadStory
    ? `${leadStory.title} (${leadStory.source}) is the main item worth attention.`
    : "No single dominant global headline is strong enough to define the session.";
  const marketRead = buildMarketConfirmationSentence(context);
  const watch = buildWatchNextSentence(context, newsItems);

  return sanitizeUserFacingText(`${lead} ${marketRead} ${watch} ${getDataQualityLine("Low")}`);
}

function buildMarketConfirmationSentence(context) {
  const marketAssets = context.markets.assets ?? [];
  const spy = marketAssets.find((asset) => asset.symbol === "SPX");
  const qqq = marketAssets.find((asset) => asset.symbol === "NDX");
  const gld = marketAssets.find((asset) => asset.symbol === "XAU");
  const uso = marketAssets.find((asset) => asset.symbol === "WTI");
  const equityAverage = averageChange([spy, qqq]);
  const hedgeAverage = averageChange([gld, uso]);

  if (equityAverage > 0.15 && hedgeAverage <= 0.15) {
    return "Markets are absorbing headline risk for now; oil and gold are not confirming a broad risk-off move.";
  }
  if (equityAverage < -0.15 && hedgeAverage > 0.15) {
    return "Markets are showing stress confirmation through weaker equities and firmer macro hedges.";
  }
  if (Math.abs(equityAverage - hedgeAverage) <= 0.3) {
    return "Market confirmation is mixed, so treat the news signal as directional rather than decisive.";
  }

  const strongestText = strongestAssetText([spy, qqq, gld, uso], "strongest");
  const weakestText = strongestAssetText([spy, qqq, gld, uso], "weakest");
  return `${strongestText} ${weakestText} Cross-asset confirmation is uneven.`;
}

function buildWatchNextSentence(context, newsItems) {
  const watchItems = [];
  const hasGeopolitics = newsItems.some((item) => classifyBriefingStory(item) === "geopolitics");
  const hasAiTech = newsItems.some((item) => classifyBriefingStory(item) === "ai-tech" && !isLowImpactStory(item));

  if (hasGeopolitics) watchItems.push("oil", "gold", "policy or military follow-through");
  watchItems.push("SPY/QQQ risk appetite", "BTC/ETH confirmation");
  if (hasAiTech) watchItems.push("AI/chip read-through");

  return `Watch ${uniqueValues(watchItems).slice(0, 5).join(", ")} next.`;
}

function averageChange(assets) {
  const values = assets
    .map((asset) => asset?.change)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function strongestAssetText(assets, direction) {
  const sorted = assets
    .filter((asset) => asset && typeof asset.change === "number" && Number.isFinite(asset.change))
    .sort((a, b) => direction === "strongest" ? b.change - a.change : a.change - b.change);
  const asset = sorted[0];

  if (!asset) return direction === "strongest" ? "No clear strongest market signal." : "No clear weakest market signal.";

  return `${asset.name} is the ${direction} market read at ${formatSigned(asset.change)}.`;
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
  const dataQualityLine = getDataQualityLine(feedQuality);

  if (/Confidence\s*\/\s*Data Quality:/i.test(text)) {
    return text.replace(/Confidence\s*\/\s*Data Quality:\s*[^.]+\.?/i, dataQualityLine);
  }

  return `${text} ${dataQualityLine}`;
}

function getDataQualityLine(feedQuality) {
  return feedQuality === "Low"
    ? `Confidence / Data Quality: ${LOW_DATA_QUALITY_MESSAGE}`
    : `Confidence / Data Quality: ${feedQuality}.`;
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
