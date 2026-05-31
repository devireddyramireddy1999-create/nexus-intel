import type {
  ChangeInsight,
  IntelligenceStory,
  MarketAsset,
  NexusJudgment,
  PersonalContext,
  RiskSignal,
  SmartAlert,
  SmartAlertSeverity,
  SmartAlertType,
} from "@/types/intel";

type AlertEngineInput = {
  changeInsights?: ChangeInsight[];
  cryptoAssets?: MarketAsset[];
  judgment: NexusJudgment;
  marketAssets?: MarketAsset[];
  personalContext?: PersonalContext;
  riskSignals?: RiskSignal[];
  stories?: IntelligenceStory[];
};

type AlertCandidate = Omit<SmartAlert, "createdAt" | "id">;

type AlertEngineResult = {
  activeAlerts: SmartAlert[];
  history: SmartAlert[];
  mutedLow: boolean;
};

const alertHistoryKey = "nexus-smart-alerts:v1";
const muteLowKey = "nexus-smart-alerts-muted-low:v1";
const duplicateWindowMs = 45 * 60 * 1000;
const maxHistoryItems = 40;
export const SMART_ALERTS_EVENT = "nexus-smart-alerts-updated";

const severityRank: Record<SmartAlertSeverity, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export function evaluateSmartAlerts(input: AlertEngineInput): AlertEngineResult {
  const previousHistory = getSmartAlertHistory();
  const candidates = buildAlertCandidates(input);
  const activeAlerts = reconcileActiveAlerts(candidates, previousHistory);
  const history = mergeAlertHistory(activeAlerts, previousHistory);

  writeAlertHistory(history);

  const mutedLow = getMuteLowAlerts();
  return {
    activeAlerts: mutedLow ? activeAlerts.filter((alert) => alert.severity !== "Low") : activeAlerts,
    history,
    mutedLow,
  };
}

export function getSmartAlertHistory(): SmartAlert[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(alertHistoryKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSmartAlert).slice(0, maxHistoryItems) : [];
  } catch {
    return [];
  }
}

export function clearSmartAlertHistory() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(alertHistoryKey);
  notifyAlertChange({ activeAlerts: [], history: [], mutedLow: getMuteLowAlerts() });
}

export function getMuteLowAlerts() {
  if (typeof window === "undefined") return false;

  return window.localStorage.getItem(muteLowKey) === "true";
}

export function setMuteLowAlerts(value: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(muteLowKey, value ? "true" : "false");
}

function buildAlertCandidates({
  changeInsights = [],
  cryptoAssets = [],
  judgment,
  marketAssets = [],
  personalContext,
  riskSignals = [],
  stories = [],
}: AlertEngineInput): AlertCandidate[] {
  const assets = mergeAssets(marketAssets, cryptoAssets);
  const riskScore = getGlobalRiskScore(riskSignals);
  const spy = getChange(assets, ["SPX", "SPY"]);
  const qqq = getChange(assets, ["NDX", "QQQ"]);
  const btc = getChange(assets, ["BTC"]);
  const oil = getChange(assets, ["WTI", "USO"]);
  const gold = getChange(assets, ["XAU", "GLD"]);
  const usdInr = getChange(assets, ["USDINR"]);
  const equities = averageFinite([spy, qqq]);
  const headlineRisk = hasHeadlineRisk(stories) || Boolean(getDominantTheme(stories, changeInsights)) || isAtLeast(riskScore, 60);
  const candidates: AlertCandidate[] = [];

  addCryptoAlerts(candidates, btc, personalContext);
  addMarketAlerts(candidates, spy, qqq, personalContext);
  addGeopoliticalAlerts(candidates, { equities, gold, headlineRisk, oil, stories, changeInsights });
  addRiskAlerts(candidates, riskScore, judgment);
  addFxAlerts(candidates, usdInr, personalContext);
  addPersonalFocusAlert(candidates, judgment, personalContext);

  return candidates
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 7);
}

function addCryptoAlerts(candidates: AlertCandidate[], btc: number, personalContext?: PersonalContext) {
  if (!Number.isFinite(btc) || btc > -3) return;

  const severity: SmartAlertSeverity = btc <= -5 ? "High" : "Medium";
  const watchlistNote = isOnWatchlist(personalContext, ["btc", "bitcoin", "crypto"]) ? " This is on your watchlist." : "";

  candidates.push(createCandidate({
    action: "Watch, do not make emotional decisions.",
    fingerprint: "crypto:btc-weakness",
    meaning: `Crypto risk is weakening.${watchlistNote}`,
    severity,
    title: "BTC weakness detected",
    trigger: `BTC ${severity} weakness`,
    type: "Crypto Alert",
    why: `BTC is down ${formatPercent(Math.abs(btc))}.`,
  }));
}

function addMarketAlerts(candidates: AlertCandidate[], spy: number, qqq: number, personalContext?: PersonalContext) {
  if (Number.isFinite(qqq) && qqq <= -1.5) {
    candidates.push(createCandidate({
      action: "Stay patient and confirm whether weakness spreads before reacting.",
      fingerprint: "market:qqq-pressure",
      meaning: `Growth risk appetite is weakening.${isOnWatchlist(personalContext, ["qqq", "nasdaq", "tech"]) ? " This is on your watchlist." : ""}`,
      severity: "Medium",
      title: "QQQ pressure detected",
      trigger: "QQQ below -1.5%",
      type: "Market Alert",
      why: `QQQ is down ${formatPercent(Math.abs(qqq))}.`,
    }));
    return;
  }

  if (Number.isFinite(spy) && Number.isFinite(qqq) && spy < -0.2 && qqq < -0.2) {
    candidates.push(createCandidate({
      action: "Watch breadth and QQQ before changing posture.",
      fingerprint: "market:equities-both-down",
      meaning: "Equity risk appetite is softer, but this still needs confirmation.",
      severity: "Medium",
      title: "Equity risk softening",
      trigger: "SPY and QQQ both negative",
      type: "Market Alert",
      why: `SPY and QQQ are both negative today.`,
    }));
  }
}

function addGeopoliticalAlerts(
  candidates: AlertCandidate[],
  {
    changeInsights,
    equities,
    gold,
    headlineRisk,
    oil,
    stories,
  }: {
    changeInsights: ChangeInsight[];
    equities: number;
    gold: number;
    headlineRisk: boolean;
    oil: number;
    stories: IntelligenceStory[];
  },
) {
  const dominantTheme = getDominantTheme(stories, changeInsights);

  if (Number.isFinite(oil) && Number.isFinite(gold) && Number.isFinite(equities) && oil > 0.6 && gold > 0.3 && equities < -0.2) {
    candidates.push(createCandidate({
      action: "Stay defensive and watch energy, gold, and QQQ together.",
      fingerprint: "geo:confirmed-stress",
      meaning: "Headline risk is becoming market-relevant.",
      severity: "High",
      title: "Geopolitical stress confirmed",
      trigger: "Oil and gold up while equities fall",
      type: "Geopolitical Alert",
      why: "Oil and gold are rising while equities are weakening.",
    }));
    return;
  }

  if (headlineRisk && Number.isFinite(oil) && Number.isFinite(gold) && oil < -0.15 && gold < -0.15) {
    candidates.push(createCandidate({
      action: "Treat headlines as watch-only until oil, gold, or equities confirm stress.",
      fingerprint: "geo:not-confirmed",
      meaning: "Market confirmation is weak.",
      severity: "Low",
      title: "Geopolitical risk not confirmed",
      trigger: "Headline risk without oil/gold confirmation",
      type: "Geopolitical Alert",
      why: "Headlines are elevated, but oil and gold are weak.",
    }));
  }

  if (dominantTheme) {
    candidates.push(createCandidate({
      action: "Treat it as continuation unless a new escalation appears.",
      fingerprint: `geo:theme:${dominantTheme.key}`,
      meaning: "Repeated coverage matters, but repetition is not the same as a new event.",
      severity: dominantTheme.sourceCount >= 4 ? "Medium" : "Low",
      title: `${dominantTheme.label} theme repeating`,
      trigger: `${dominantTheme.label} across ${dominantTheme.sourceCount}+ sources`,
      type: "Geopolitical Alert",
      why: `The same theme is appearing across ${dominantTheme.sourceCount}+ strong sources.`,
    }));
  }
}

function addRiskAlerts(candidates: AlertCandidate[], riskScore: number | undefined, judgment: NexusJudgment) {
  if (isAtLeast(riskScore, 85)) {
    candidates.push(createCandidate({
      action: "Reduce noise and monitor confirmation triggers.",
      fingerprint: "risk:score-critical",
      meaning: "Conditions are becoming more defensive.",
      severity: "Critical",
      title: "Risk posture critical",
      trigger: "Risk score above 85",
      type: "Risk Alert",
      why: `Global risk score is ${Math.round(riskScore ?? 0)}.`,
    }));
    return;
  }

  if (isAtLeast(riskScore, 70) || judgment.riskPosture === "Elevated" || judgment.riskPosture === "Defensive") {
    candidates.push(createCandidate({
      action: judgment.bestAction,
      fingerprint: "risk:posture-elevated",
      meaning: "Conditions deserve more discipline, not faster reactions.",
      severity: isAtLeast(riskScore, 70) || judgment.riskPosture === "Defensive" ? "High" : "Medium",
      title: "Risk posture elevated",
      trigger: judgment.riskPosture,
      type: "Risk Alert",
      why: `NEXUS Judgment is ${judgment.riskPosture}.`,
    }));
  }
}

function addFxAlerts(candidates: AlertCandidate[], usdInr: number, personalContext?: PersonalContext) {
  if (!Number.isFinite(usdInr) || Math.abs(usdInr) < 0.75) return;

  candidates.push(createCandidate({
    action: "Watch dollar pressure before trusting broad risk appetite.",
    fingerprint: "market:usdinr-watch",
    meaning: `FX pressure may affect global risk and India-linked decisions.${isOnWatchlist(personalContext, ["usdinr", "usd/inr", "dollar", "rupee"]) ? " This is on your watchlist." : ""}`,
    severity: Math.abs(usdInr) >= 1.25 ? "High" : "Medium",
    title: "USD/INR watch",
    trigger: `USDINR ${usdInr > 0 ? "higher" : "lower"}`,
    type: "Market Alert",
    why: `USD/INR moved ${formatPercent(Math.abs(usdInr))}.`,
  }));
}

function addPersonalFocusAlert(candidates: AlertCandidate[], judgment: NexusJudgment, personalContext?: PersonalContext) {
  if (!personalContext || !hasPersonalContext(personalContext)) return;
  if (!/overcheck|overchecking|distraction|distract|too much news|markets|crypto/i.test(personalContext.thingsToAvoid)) return;
  if (candidates.some((alert) => severityRank[alert.severity] >= severityRank.High)) return;

  const project = personalContext.currentPrimaryProject || personalContext.workSchoolPriority || personalContext.mainLifeGoal || "today's main work";

  candidates.push(createCandidate({
    action: `Focus on ${project} before checking more headlines.`,
    fingerprint: "personal:focus-warning",
    meaning: "No urgent market move is needed right now.",
    severity: "Low",
    title: "Personal focus warning",
    trigger: "No major alert with personal avoidance rule",
    type: "Personal Focus Alert",
    why: "Your context says to avoid overchecking markets.",
  }));
}

function reconcileActiveAlerts(candidates: AlertCandidate[], history: SmartAlert[]) {
  const now = Date.now();

  return candidates.map((candidate) => {
    const existing = history.find((alert) => alert.fingerprint === candidate.fingerprint);
    const shouldCreate =
      !existing ||
      existing.severity !== candidate.severity ||
      existing.trigger !== candidate.trigger ||
      now - Date.parse(existing.createdAt) > duplicateWindowMs;

    if (shouldCreate) {
      return {
        ...candidate,
        createdAt: new Date(now).toISOString(),
        id: `${candidate.fingerprint}:${now}`,
      };
    }

    return {
      ...existing,
      ...candidate,
      createdAt: existing.createdAt,
      id: existing.id,
    };
  });
}

function mergeAlertHistory(activeAlerts: SmartAlert[], history: SmartAlert[]) {
  const alertsById = new Map<string, SmartAlert>();

  for (const alert of [...activeAlerts, ...history]) {
    alertsById.set(alert.id, alert);
  }

  return [...alertsById.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, maxHistoryItems);
}

function createCandidate(candidate: AlertCandidate): AlertCandidate {
  return candidate;
}

function mergeAssets(marketAssets: MarketAsset[], cryptoAssets: MarketAsset[]) {
  const assetsBySymbol = new Map<string, MarketAsset>();

  for (const asset of marketAssets) {
    assetsBySymbol.set(asset.symbol, asset);
    if (asset.proxySymbol) assetsBySymbol.set(asset.proxySymbol, asset);
  }

  for (const asset of cryptoAssets) {
    assetsBySymbol.set(asset.symbol, asset);
  }

  return assetsBySymbol;
}

function getChange(assets: Map<string, MarketAsset>, symbols: string[]) {
  for (const symbol of symbols) {
    const value = assets.get(symbol)?.change;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return Number.NaN;
}

function averageFinite(values: number[]) {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return Number.NaN;

  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function getGlobalRiskScore(riskSignals: RiskSignal[]) {
  return riskSignals.find((signal) => /global/i.test(signal.label))?.value ?? riskSignals[0]?.value;
}

function getDominantTheme(stories: IntelligenceStory[], changeInsights: ChangeInsight[]) {
  const repeatedInsight = changeInsights.find((insight) => insight.classification === "Repeated theme")?.text ?? "";
  const repeatedInsightLabel = getThemeLabel(repeatedInsight);
  if (repeatedInsightLabel) {
    return {
      key: slugify(repeatedInsightLabel),
      label: repeatedInsightLabel,
      sourceCount: 3,
    };
  }

  const repeatedStory = stories.find((story) => {
    const sourceCount = story.sourceCount ?? story.coveredBy?.length ?? 1;
    return sourceCount >= 3 && isRiskStory(story);
  });

  if (!repeatedStory) return null;

  const label = getThemeLabel(`${repeatedStory.title} ${repeatedStory.summary}`);
  if (!label) return null;

  return {
    key: slugify(label),
    label,
    sourceCount: repeatedStory.sourceCount ?? repeatedStory.coveredBy?.length ?? 3,
  };
}

function hasHeadlineRisk(stories: IntelligenceStory[]) {
  return stories.some(isRiskStory);
}

function isRiskStory(story: IntelligenceStory) {
  const text = `${story.section} ${story.title} ${story.summary} ${story.impact}`.toLowerCase();
  return /\b(war|conflict|sanction|military|oil|shipping|security|iran|hormuz|russia|ukraine|inflation|rates|central bank|diplomacy|border)\b/.test(text);
}

function getThemeLabel(text: string) {
  const value = text.toLowerCase();

  if (/\b(iran|hormuz|strait)\b/.test(value)) return "Iran / Strait of Hormuz";
  if (/\b(russia|ukraine|kyiv|zelensky)\b/.test(value)) return "Russia-Ukraine";
  if (/\b(oil|energy|shipping|supply chain|red sea)\b/.test(value)) return "Oil / energy pressure";
  if (/\b(gold|safe haven|safe-haven)\b/.test(value)) return "Gold safe haven";
  if (/\b(fed|rates|inflation|central bank|treasury)\b/.test(value)) return "Fed / rates";
  if (/\b(ai|artificial intelligence|chip|semiconductor|nvidia|openai|cybersecurity)\b/.test(value)) return "AI / chip cycle";
  if (/\b(bitcoin|btc|crypto|ethereum|eth|solana|sol)\b/.test(value)) return "Crypto risk";
  if (/\b(election|policy|trade|tariff|sanction)\b/.test(value)) return "Policy / trade risk";

  return "";
}

function isOnWatchlist(personalContext: PersonalContext | undefined, terms: string[]) {
  const watchlist = personalContext?.personalWatchlist?.toLowerCase() ?? "";
  return terms.some((term) => watchlist.includes(term));
}

function hasPersonalContext(personalContext: PersonalContext) {
  return Object.values(personalContext).some((value) => value.trim().length > 0);
}

function isAtLeast(value: number | undefined, threshold: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= threshold;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isSmartAlert(value: unknown): value is SmartAlert {
  const alert = value as Partial<SmartAlert>;
  return Boolean(
    alert &&
      typeof alert.action === "string" &&
      typeof alert.createdAt === "string" &&
      typeof alert.fingerprint === "string" &&
      typeof alert.id === "string" &&
      typeof alert.meaning === "string" &&
      typeof alert.severity === "string" &&
      typeof alert.title === "string" &&
      typeof alert.trigger === "string" &&
      typeof alert.type === "string" &&
      typeof alert.why === "string",
  );
}

function writeAlertHistory(history: SmartAlert[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(alertHistoryKey, JSON.stringify(history));
    notifyAlertChange({
      activeAlerts: [],
      history,
      mutedLow: getMuteLowAlerts(),
    });
  } catch {
    // Restricted browser storage should not block the dashboard.
  }
}

function notifyAlertChange(detail: AlertEngineResult) {
  window.dispatchEvent(new CustomEvent(SMART_ALERTS_EVENT, { detail }));
}
