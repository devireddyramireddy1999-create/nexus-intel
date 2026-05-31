import { priorities } from "@/data/mockData";
import type {
  ChangeInsight,
  IntelligenceStory,
  MarketAsset,
  RiskSignal,
  TechSignal,
} from "@/types/intel";
import type { NewsItem } from "@/services/newsService";
import { getMarketAssetPrice } from "@/services/marketFormatting";

type SnapshotMeta = {
  fallback?: boolean;
  source?: string;
};

type SnapshotAsset = {
  change: number;
  price: number;
  symbol: string;
};

type NewsTheme = {
  category?: string;
  key: string;
  label: string;
  sourceCount: number;
  strong: boolean;
  title: string;
};

type IntelligenceSnapshot = {
  aiSignalScore?: number;
  assets: Record<string, SnapshotAsset>;
  briefingHeadline?: string;
  dataQuality?: string;
  globalRiskScore?: number;
  newsThemes: NewsTheme[];
  prioritySyncScore?: number;
  timestamp: string;
};

type SnapshotPatch = Partial<Omit<IntelligenceSnapshot, "assets" | "newsThemes" | "timestamp">> & {
  assets?: Record<string, SnapshotAsset>;
  newsThemes?: NewsTheme[];
};

const latestSnapshotKey = "nexus-intel-latest-snapshot:v1";
const previousSnapshotKey = "nexus-intel-previous-snapshot:v1";
const changeInsightsKey = "nexus-intel-change-insights:v1";
const snapshotRollMs = 5 * 60 * 1000;
export const CHANGE_INTELLIGENCE_EVENT = "nexus-intel-change-intelligence";

const marketSymbolMap: Record<string, string> = {
  NDX: "QQQ",
  SPX: "SPY",
  WTI: "USO",
  XAU: "GLD",
};

const trackedSymbols = new Set(["SPY", "QQQ", "GLD", "USO", "USDINR", "BTC", "ETH", "SOL"]);
const weakThemeWords = new Set([
  "after",
  "amid",
  "before",
  "could",
  "fall",
  "falls",
  "fell",
  "give",
  "gives",
  "given",
  "giving",
  "latest",
  "market",
  "markets",
  "more",
  "news",
  "price",
  "prices",
  "says",
  "said",
  "stock",
  "stocks",
  "than",
  "that",
  "this",
  "warns",
  "will",
  "with",
]);

export function recordMarketSnapshot(data: { assets?: MarketAsset[] }, meta?: SnapshotMeta) {
  if (!isSuccessfulMeta(meta)) return;

  updateSnapshot({
    assets: extractAssetSnapshot(data.assets ?? []),
  });
}

export function recordCryptoSnapshot(data: { assets?: MarketAsset[] }, meta?: SnapshotMeta) {
  if (!isSuccessfulMeta(meta)) return;

  updateSnapshot({
    assets: extractAssetSnapshot(data.assets ?? []),
  });
}

export function recordNewsSnapshot(
  data: {
    newsItems?: NewsItem[];
    riskSignals?: RiskSignal[];
    stories?: IntelligenceStory[];
    techSignals?: TechSignal[];
  },
  meta?: SnapshotMeta,
) {
  if (!isSuccessfulMeta(meta)) return;

  updateSnapshot({
    aiSignalScore: getAiSignalScore(data.techSignals ?? []),
    globalRiskScore: getGlobalRiskScore(data.riskSignals ?? []),
    newsThemes: extractNewsThemes(data),
    prioritySyncScore: getPrioritySyncScore(),
  });
}

export function recordBriefingSnapshot(data: unknown, meta?: SnapshotMeta) {
  if (!isSuccessfulMeta(meta)) return;
  if (!data || typeof data !== "object") return;

  const briefing = data as { dataQuality?: unknown; headline?: unknown };
  updateSnapshot({
    briefingHeadline: typeof briefing.headline === "string" ? briefing.headline : undefined,
    dataQuality: typeof briefing.dataQuality === "string" ? briefing.dataQuality : undefined,
    prioritySyncScore: getPrioritySyncScore(),
  });
}

export function getChangeInsights(): ChangeInsight[] {
  return readJson<ChangeInsight[]>(changeInsightsKey) ?? [];
}

function updateSnapshot(patch: SnapshotPatch) {
  if (typeof window === "undefined") return;

  const latest = readSnapshot(latestSnapshotKey);
  let previous = readSnapshot(previousSnapshotKey);
  const shouldRoll = latest && Date.now() - Date.parse(latest.timestamp) > snapshotRollMs;

  if (latest && shouldRoll) {
    previous = latest;
    writeJson(previousSnapshotKey, latest);
  }

  const next = mergeSnapshot(latest, patch);
  writeJson(latestSnapshotKey, next);

  const insights = buildChangeInsights(previous, next);
  writeJson(changeInsightsKey, insights);
  window.dispatchEvent(new CustomEvent(CHANGE_INTELLIGENCE_EVENT, { detail: insights }));
}

function mergeSnapshot(current: IntelligenceSnapshot | null, patch: SnapshotPatch): IntelligenceSnapshot {
  return {
    aiSignalScore: patch.aiSignalScore ?? current?.aiSignalScore,
    assets: {
      ...(current?.assets ?? {}),
      ...(patch.assets ?? {}),
    },
    briefingHeadline: patch.briefingHeadline ?? current?.briefingHeadline,
    dataQuality: patch.dataQuality ?? current?.dataQuality,
    globalRiskScore: patch.globalRiskScore ?? current?.globalRiskScore,
    newsThemes: patch.newsThemes ?? current?.newsThemes ?? [],
    prioritySyncScore: patch.prioritySyncScore ?? current?.prioritySyncScore,
    timestamp: new Date().toISOString(),
  };
}

function buildChangeInsights(previous: IntelligenceSnapshot | null, current: IntelligenceSnapshot): ChangeInsight[] {
  if (!previous) {
    const baselineInsights: ChangeInsight[] = [
      {
        classification: "New",
        text: "Baseline captured.",
      },
      {
        classification: "New",
        text: "NEXUS will compare the next refresh against this state.",
      },
      {
        classification: "Unchanged",
        text: summarizeCurrentState(current),
      },
    ];
    return withDataQualityCaution(current, baselineInsights);
  }

  const insights: ChangeInsight[] = [];
  addCrossAssetInsight(insights, previous, current);
  addRiskInsight(insights, previous, current);
  addCryptoInsight(insights, previous, current);
  addEquityInsight(insights, previous, current);
  addEnergyGoldInsight(insights, current);
  addUsdInrInsight(insights, previous, current);
  addAiInsight(insights, previous, current);
  addNewsInsights(insights, previous, current);

  if (insights.length < 3) {
    insights.push({
      classification: "Unchanged",
      text: summarizeCurrentState(current),
    });
  }

  return withDataQualityCaution(current, insights).slice(0, 6);
}

function withDataQualityCaution(snapshot: IntelligenceSnapshot, insights: ChangeInsight[]): ChangeInsight[] {
  if (!isLowDataQuality(snapshot.dataQuality)) return insights;

  return [
    {
      classification: "Unchanged",
      text: "Signal quality is limited; treat this brief as directional.",
    },
    ...insights,
  ];
}

function addCrossAssetInsight(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousCrypto = averageChange(previous, ["BTC", "ETH", "SOL"]);
  const currentCrypto = averageChange(current, ["BTC", "ETH", "SOL"]);
  const currentEquities = averageChange(current, ["SPY", "QQQ"]);
  const currentRisk = current.globalRiskScore;
  if (!Number.isFinite(previousCrypto) || !Number.isFinite(currentCrypto) || !Number.isFinite(currentEquities)) return;

  const cryptoDelta = currentCrypto - previousCrypto;
  if (cryptoDelta <= -0.5 && currentEquities > -0.15) {
    insights.push({
      classification: "Worsened",
      text: `${capitalize(getDirectionLabel(currentCrypto))} crypto while equities ${getDirectionVerb(currentEquities)}; risk appetite is mixed. ${capitalize(getRiskClause(currentRisk))}, but markets are not confirming panic yet.`,
    });
  } else if (cryptoDelta >= 0.5 && currentEquities > -0.15) {
    insights.push({
      classification: "Improved",
      text: `Crypto improved while equities ${getDirectionVerb(currentEquities)}; risk appetite is better. Confirm with BTC and QQQ before reacting.`,
    });
  }
}

function addRiskInsight(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousRisk = previous.globalRiskScore;
  const currentRisk = current.globalRiskScore;
  if (typeof previousRisk !== "number" || typeof currentRisk !== "number") return;

  const delta = currentRisk - previousRisk;
  if (delta >= 5) {
    insights.push({
      classification: "Worsened",
      text: `Global risk rose ${formatPoints(delta)}. Watch oil, gold, and equity breadth before reacting.`,
    });
  } else if (delta <= -5) {
    insights.push({
      classification: "Improved",
      text: `Global risk eased ${formatPoints(Math.abs(delta))}. Keep headlines on watch, but require price confirmation.`,
    });
  }
}

function addCryptoInsight(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousCrypto = averageChange(previous, ["BTC", "ETH", "SOL"]);
  const currentCrypto = averageChange(current, ["BTC", "ETH", "SOL"]);
  if (!Number.isFinite(previousCrypto) || !Number.isFinite(currentCrypto)) return;

  const delta = currentCrypto - previousCrypto;
  if (delta >= 0.5) {
    insights.push({
      classification: "Improved",
      text: "Crypto improved; confirm BTC and ETH before adding risk.",
    });
  } else if (delta <= -0.5) {
    insights.push({
      classification: "Worsened",
      text: "Crypto weakened; wait for BTC/ETH confirmation before adding risk.",
    });
  } else {
    insights.push({
      classification: "Unchanged",
      text: "Crypto is steady; wait for direction rather than forcing a signal.",
    });
  }
}

function addEquityInsight(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousEquities = averageChange(previous, ["SPY", "QQQ"]);
  const currentEquities = averageChange(current, ["SPY", "QQQ"]);
  if (!Number.isFinite(previousEquities) || !Number.isFinite(currentEquities)) return;

  const delta = currentEquities - previousEquities;
  if (delta >= 0.35) {
    insights.push({
      classification: "Improved",
      text: "Equities strengthened; SPY/QQQ are absorbing the risk tape for now.",
    });
  } else if (delta <= -0.35) {
    insights.push({
      classification: "Worsened",
      text: "Equities weakened; watch whether pressure spreads into breadth.",
    });
  }
}

function addEnergyGoldInsight(insights: ChangeInsight[], current: IntelligenceSnapshot) {
  const oil = current.assets.USO;
  const gold = current.assets.GLD;
  const hasGeoTheme = current.newsThemes.some((theme) => /war|iran|oil|military|conflict|sanction|security|hormuz/i.test(theme.title));

  if (oil && oil.change < -0.2 && hasGeoTheme) {
    insights.push({
      classification: "Unchanged",
      text: "Oil remains negative, so energy markets are not confirming panic yet.",
    });
  }

  if (gold && gold.change < -0.2 && hasGeoTheme) {
    insights.push({
      classification: "Unchanged",
      text: "Gold is down, so safe-haven demand is not strongly confirming geopolitical stress.",
    });
  }
}

function addUsdInrInsight(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousUsdInr = previous.assets.USDINR?.price;
  const currentUsdInr = current.assets.USDINR?.price;
  if (!Number.isFinite(previousUsdInr) || !Number.isFinite(currentUsdInr)) return;

  const delta = currentUsdInr - previousUsdInr;
  if (delta >= 0.2) {
    insights.push({
      classification: "Worsened",
      text: "USD/INR moved higher; watch dollar pressure before trusting risk appetite.",
    });
  } else if (delta <= -0.2) {
    insights.push({
      classification: "Improved",
      text: "USD/INR eased; dollar pressure is less of a drag for now.",
    });
  }
}

function addAiInsight(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousAi = previous.aiSignalScore;
  const currentAi = current.aiSignalScore;
  if (typeof previousAi !== "number" || typeof currentAi !== "number") return;

  const delta = currentAi - previousAi;
  if (delta >= 4) {
    insights.push({
      classification: "Improved",
      text: "AI signal strength improved; focus on chips, cloud, power, or security demand.",
    });
  } else if (delta <= -4) {
    insights.push({
      classification: "Worsened",
      text: "AI signal strength faded; skip tech headlines without infrastructure read-through.",
    });
  }
}

function addNewsInsights(insights: ChangeInsight[], previous: IntelligenceSnapshot, current: IntelligenceSnapshot) {
  const previousKeys = new Set(previous.newsThemes.map((theme) => theme.key));
  const dominantTheme = current.newsThemes.find((theme) => theme.strong && (theme.sourceCount > 1 || previousKeys.has(theme.key)));

  if (dominantTheme) {
    insights.push({
      classification: "Repeated theme",
      text: `${getThemeLabel(dominantTheme)} remains the repeated theme; treat it as continuation unless a new escalation appears.`,
    });
    return;
  }

  const newTheme = current.newsThemes.find((theme) => theme.strong && !previousKeys.has(theme.key));
  if (newTheme) {
    insights.push({
      classification: "New",
      text: `${getThemeLabel(newTheme)} is new; check whether prices confirm before giving it weight.`,
    });
    return;
  }

  insights.push({
    classification: "Unchanged",
    text: "No dominant repeated theme yet.",
  });
}

function summarizeCurrentState(snapshot: IntelligenceSnapshot) {
  const equities = averageChange(snapshot, ["SPY", "QQQ"]);
  const crypto = averageChange(snapshot, ["BTC", "ETH", "SOL"]);
  const oil = snapshot.assets.USO?.change;
  const gold = snapshot.assets.GLD?.change;
  const theme = snapshot.newsThemes.find((item) => item.strong && item.sourceCount > 1) ?? snapshot.newsThemes.find((item) => item.strong);
  const parts = [
    Number.isFinite(equities) ? `Equities are ${getDirectionLabel(equities)}` : "",
    Number.isFinite(crypto) ? `crypto is ${getDirectionLabel(crypto)}` : "",
    buildOilGoldPhrase(oil, gold),
    getRiskClause(snapshot.globalRiskScore),
    theme ? `${getThemeLabel(theme)} is the main news theme` : "no dominant repeated theme yet",
  ].filter(Boolean);

  return parts.length ? `${parts.join("; ")}.` : "Current market, crypto, risk, and news state is saved for the next comparison.";
}

function extractAssetSnapshot(assets: MarketAsset[]) {
  const snapshot: Record<string, SnapshotAsset> = {};

  for (const asset of assets) {
    const symbol = asset.proxySymbol ?? marketSymbolMap[asset.symbol] ?? asset.symbol;
    if (!trackedSymbols.has(symbol)) continue;

    const price = parseAssetPrice(asset.value);
    if (!Number.isFinite(price)) continue;

    snapshot[symbol] = {
      change: Number.isFinite(asset.change) ? asset.change : 0,
      price,
      symbol,
    };
  }

  return snapshot;
}

function extractNewsThemes(data: {
  newsItems?: NewsItem[];
  stories?: IntelligenceStory[];
}) {
  const items = data.newsItems?.length
    ? data.newsItems.map((item) => ({
        category: item.category,
        sourceCount: item.sourceCount ?? item.coveredBy?.length ?? 1,
        title: item.title,
      }))
    : (data.stories ?? []).map((story) => ({
        category: story.section,
        sourceCount: story.sourceCount ?? story.coveredBy?.length ?? 1,
        title: story.title,
      }));

  return items.slice(0, 3).map((item) => ({
    category: item.category,
    ...classifyTheme(item.title, item.category),
    sourceCount: item.sourceCount,
    title: item.title,
  }));
}

function getGlobalRiskScore(signals: RiskSignal[]) {
  return signals.find((signal) => /global/i.test(signal.label))?.value ?? signals[0]?.value;
}

function getAiSignalScore(signals: TechSignal[]) {
  if (!signals.length) return undefined;
  return Math.round(signals.reduce((sum, signal) => sum + signal.velocity, 0) / signals.length);
}

function getPrioritySyncScore() {
  if (!priorities.length) return undefined;
  return Math.round(priorities.reduce((sum, priority) => sum + priority.energy, 0) / priorities.length);
}

function averageChange(snapshot: IntelligenceSnapshot, symbols: string[]) {
  const values = symbols
    .map((symbol) => snapshot.assets[symbol]?.change)
    .filter((value) => Number.isFinite(value));

  if (!values.length) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseAssetPrice(value: string) {
  return getMarketAssetPrice({ value });
}

function classifyTheme(title: string, category?: string) {
  const text = title.toLowerCase();
  const normalizedCategory = String(category ?? "").toLowerCase();
  const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

  if (has(/\biran\b|\bhormuz\b|\btehran\b|\bnuclear talks?\b/)) {
    return { key: "iran-conflict", label: "Iran risk", strong: true };
  }

  if (has(/\brussia\b|\bukraine\b|\bkyiv\b|\bzelenskyy?\b|\bputin\b|\bmoscow\b/)) {
    return { key: "russia-ukraine", label: "Russia-Ukraine", strong: true };
  }

  if (has(/\bfed\b|\bfederal reserve\b|\brates?\b|\binflation\b|\btreasur(y|ies)\b|\byields?\b|\bcentral bank\b|\bpowell\b/)) {
    return { key: "fed-rates", label: "Fed/rates", strong: true };
  }

  if (has(/\busd\/?inr\b|\brupee\b|\bindian rupee\b|\bdollar rupee\b/)) {
    return { key: "usd-inr", label: "USD/INR", strong: true };
  }

  if (has(/\bgold\b|\bbullion\b|\bsafe[-\s]?haven\b/)) {
    return { key: "gold-safe-haven", label: "Gold safe haven", strong: true };
  }

  if (has(/\boil\b|\bcrude\b|\bbrent\b|\bwti\b|\bopec\b/) && has(/\bpressure\b|\bshock\b|\bsupply\b|\bshipping\b|\broute\b|\bhormuz\b|\bwar\b|\bconflict\b|\brisk\b/)) {
    return { key: "oil-pressure", label: "Oil pressure", strong: true };
  }

  if (has(/\benergy\b|\bnatural gas\b|\bpower\b|\bgrid\b|\bshipping\b/) && has(/\brisk\b|\bshock\b|\bpressure\b|\bsupply\b|\bsecurity\b/)) {
    return { key: "energy-risk", label: "Energy risk", strong: true };
  }

  if (has(/\bbitcoin\b|\bbtc\b|\beth(ereum)?\b|\bsolana\b|\bsol\b|\bcrypto\b|\bcoinbase\b/) && has(/\bweak\b|\bfall(s|ing)?\b|\bdrop(s|ped)?\b|\bslump\b|\bdown\b|\bloss(es)?\b|\bsell[-\s]?off\b|\bliquidation\b/)) {
    return { key: "crypto-weakness", label: "Crypto weakness", strong: true };
  }

  if (has(/\bbitcoin\b|\bbtc\b|\beth(ereum)?\b|\bsolana\b|\bsol\b|\bcrypto\b|\bcoinbase\b/)) {
    return { key: "crypto-risk", label: "Crypto risk", strong: true };
  }

  if (has(/\bnvidia\b|\bopenai\b|\bai\b|\bartificial intelligence\b|\bsemiconductor(s)?\b|\bchips?\b|\bcloud\b|\bcybersecurity\b|\bearnings\b/) || normalizedCategory.includes("ai")) {
    return { key: "ai-earnings", label: "AI/tech", strong: true };
  }

  const fallback = extractFallbackTheme(text);
  return {
    key: fallback.key,
    label: fallback.label,
    strong: false,
  };
}

function extractFallbackTheme(text: string) {
  const words = text
    .replace(/\b(bbc|npr|cnbc|al jazeera|reuters|associated press|ap|the verge|techcrunch)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !weakThemeWords.has(word));

  const selected = words.slice(0, 3);
  if (!selected.length) {
    return { key: "general-news", label: "General news" };
  }

  return {
    key: selected.sort().join("-"),
    label: selected.map(capitalize).join(" "),
  };
}

function buildOilGoldPhrase(oil: number | undefined, gold: number | undefined) {
  if (!Number.isFinite(oil) && !Number.isFinite(gold)) return "";

  if (Number.isFinite(oil) && Number.isFinite(gold)) {
    return `oil is ${getDirectionLabel(oil)} and gold is ${getDirectionLabel(gold)}`;
  }

  if (Number.isFinite(oil)) return `oil is ${getDirectionLabel(oil)}`;
  return `gold is ${getDirectionLabel(gold)}`;
}

function getDirectionLabel(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unavailable";
  if (value >= 0.25) return "stronger";
  if (value <= -0.25) return "weaker";
  return "steady";
}

function getDirectionVerb(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "are unclear";
  if (value >= 0.25) return "are holding up";
  if (value <= -0.25) return "are weakening";
  return "are steady";
}

function getRiskClause(score: number | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "risk is not fully scored";
  if (score >= 70) return "risk is elevated";
  if (score >= 50) return "risk is guarded";
  return "risk is contained";
}

function getThemeLabel(theme: NewsTheme) {
  if (theme.label) return theme.label;
  const classified = classifyTheme(theme.title, theme.category);
  if (classified.strong) return classified.label;
  const keyWords = theme.key.split(" ").filter(Boolean);
  if (keyWords.length >= 2) return keyWords.slice(0, 4).join(" / ");
  return shorten(theme.title);
}

function isLowDataQuality(dataQuality: string | undefined) {
  if (typeof dataQuality !== "string") return false;
  const normalized = dataQuality.toLowerCase();
  return normalized.includes("low") || normalized.includes("signal quality is limited");
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shorten(text: string) {
  return text.length > 72 ? `${text.slice(0, 69).trim()}...` : text;
}

function formatPoints(value: number) {
  return `${Math.round(value)} points`;
}

function isSuccessfulMeta(meta?: SnapshotMeta) {
  return Boolean(meta && !meta.fallback && meta.source !== "mock");
}

function readSnapshot(key: string) {
  return readJson<IntelligenceSnapshot>(key);
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable in private or restricted browser modes.
  }
}
