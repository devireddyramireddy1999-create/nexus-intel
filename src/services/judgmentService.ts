import type {
  ChangeInsight,
  IntelligenceStory,
  MarketAsset,
  MarketMood,
  NexusJudgment,
  RiskPosture,
  RiskSignal,
} from "@/types/intel";

type JudgmentInput = {
  changeInsights?: ChangeInsight[];
  cryptoAssets?: MarketAsset[];
  marketAssets?: MarketAsset[];
  riskSignals?: RiskSignal[];
  stories?: IntelligenceStory[];
};

const signalQualityMessage = "Signal quality is limited; treat this read as directional.";

export function buildNexusJudgment({
  changeInsights = [],
  cryptoAssets = [],
  marketAssets = [],
  riskSignals = [],
  stories = [],
}: JudgmentInput): NexusJudgment {
  const assets = mergeAssets(marketAssets, cryptoAssets);
  const riskScore = getGlobalRiskScore(riskSignals);
  const equities = averageChange(assets, ["SPX", "NDX"]);
  const crypto = averageChange(assets, ["BTC", "ETH", "SOL"]);
  const oil = getChange(assets, "WTI");
  const gold = getChange(assets, "XAU");
  const btc = getChange(assets, "BTC");
  const qqq = getChange(assets, "NDX");
  const hasEnoughData = [equities, crypto, oil, gold].filter(Number.isFinite).length >= 3;
  const repeatedTheme = getRepeatedTheme(stories, changeInsights);
  const hasHeadlineRisk = hasRiskHeadline(stories) || Boolean(repeatedTheme) || isAtLeast(riskScore, 60);
  const oilGoldConfirmStress = isPositive(oil, 0.25) && isPositive(gold, 0.2);
  const equitiesWeak = isNegative(equities, -0.2);
  const equitiesHolding = isPositive(equities, -0.1);
  const cryptoWeak = isNegative(crypto, -0.35);
  const allRiskAssetsFall = isNegative(equities, -0.2) && isNegative(crypto, -0.35);
  const marketConfirmationWeak = hasHeadlineRisk && equitiesHolding && !oilGoldConfirmStress;

  if (!hasEnoughData) {
    return {
      riskPosture: "Watchful",
      marketMood: "Unclear",
      confirmationStatus: "Live signals are still warming; treat the first read as directional.",
      bestAction: "Wait for live prices before reacting.",
      whatToIgnore: "Ignore stale first-load impressions.",
      watchTriggers: ["SPY/QQQ update", "BTC/ETH update", "Risk score refresh"],
    };
  }

  const riskPosture = getRiskPosture({ allRiskAssetsFall, equitiesWeak, hasHeadlineRisk, oilGoldConfirmStress, riskScore });
  const marketMood = getMarketMood({ allRiskAssetsFall, crypto, equities, equitiesWeak, gold, oil, oilGoldConfirmStress });
  const confirmationStatus = getConfirmationStatus({
    allRiskAssetsFall,
    cryptoWeak,
    equitiesHolding,
    equitiesWeak,
    gold,
    hasHeadlineRisk,
    marketConfirmationWeak,
    oil,
    oilGoldConfirmStress,
    repeatedTheme,
  });
  const whatToIgnore = getIgnoreLine({ cryptoWeak, marketConfirmationWeak, repeatedTheme });

  return {
    riskPosture,
    marketMood,
    confirmationStatus,
    bestAction: getBestAction({ confirmationStatus, marketMood, riskPosture }),
    whatToIgnore,
    watchTriggers: getWatchTriggers({ btc, gold, qqq, repeatedTheme, riskScore, oil }),
  };
}

export function formatNexusReadItems(judgment: NexusJudgment) {
  return [
    `Posture: ${judgment.riskPosture}. Market mood: ${judgment.marketMood}.`,
    `Market confirmation: ${judgment.confirmationStatus}`,
    `Action: ${judgment.bestAction}`,
    `Ignore: ${judgment.whatToIgnore}`,
    `Watch: ${judgment.watchTriggers.join(", ")}.`,
  ];
}

function mergeAssets(marketAssets: MarketAsset[], cryptoAssets: MarketAsset[]) {
  const assetsBySymbol = new Map<string, MarketAsset>();

  for (const asset of marketAssets) {
    assetsBySymbol.set(asset.symbol, asset);
  }

  for (const asset of cryptoAssets) {
    assetsBySymbol.set(asset.symbol, asset);
  }

  return [...assetsBySymbol.values()];
}

function getGlobalRiskScore(riskSignals: RiskSignal[]) {
  return riskSignals.find((signal) => /global/i.test(signal.label))?.value ?? riskSignals[0]?.value;
}

function averageChange(assets: MarketAsset[], symbols: string[]) {
  const values = symbols.map((symbol) => getChange(assets, symbol)).filter(Number.isFinite);
  if (!values.length) return Number.NaN;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getChange(assets: MarketAsset[], symbol: string) {
  const value = assets.find((asset) => asset.symbol === symbol)?.change;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function getRiskPosture({
  allRiskAssetsFall,
  equitiesWeak,
  hasHeadlineRisk,
  oilGoldConfirmStress,
  riskScore,
}: {
  allRiskAssetsFall: boolean;
  equitiesWeak: boolean;
  hasHeadlineRisk: boolean;
  oilGoldConfirmStress: boolean;
  riskScore?: number;
}): RiskPosture {
  if (isAtLeast(riskScore, 85) && (allRiskAssetsFall || oilGoldConfirmStress)) return "Crisis";
  if (isAtLeast(riskScore, 75) || allRiskAssetsFall || (equitiesWeak && oilGoldConfirmStress)) return "Defensive";
  if (isAtLeast(riskScore, 60) || (hasHeadlineRisk && oilGoldConfirmStress)) return "Elevated";
  if (isAtLeast(riskScore, 45) || hasHeadlineRisk) return "Watchful";
  return "Calm";
}

function getMarketMood({
  allRiskAssetsFall,
  crypto,
  equities,
  equitiesWeak,
  gold,
  oil,
  oilGoldConfirmStress,
}: {
  allRiskAssetsFall: boolean;
  crypto: number;
  equities: number;
  equitiesWeak: boolean;
  gold: number;
  oil: number;
  oilGoldConfirmStress: boolean;
}): MarketMood {
  if (allRiskAssetsFall) return "Risk-off";
  if (equitiesWeak && oilGoldConfirmStress) return "Defensive";
  if (isPositive(equities, 0.15) && isPositive(crypto, 0.15) && !isPositive(oil, 1)) return "Risk-on";
  if (isPositive(equities, 0.1) && isNegative(crypto, -0.35)) return "Mixed";
  if (isNegative(equities, -0.2) || isNegative(crypto, -0.35) || isPositive(gold, 0.3) || isPositive(oil, 0.6)) return "Mixed";
  return "Unclear";
}

function getConfirmationStatus({
  allRiskAssetsFall,
  cryptoWeak,
  equitiesHolding,
  equitiesWeak,
  gold,
  hasHeadlineRisk,
  marketConfirmationWeak,
  oil,
  oilGoldConfirmStress,
  repeatedTheme,
}: {
  allRiskAssetsFall: boolean;
  cryptoWeak: boolean;
  equitiesHolding: boolean;
  equitiesWeak: boolean;
  gold: number;
  hasHeadlineRisk: boolean;
  marketConfirmationWeak: boolean;
  oil: number;
  oilGoldConfirmStress: boolean;
  repeatedTheme: string;
}) {
  if (allRiskAssetsFall) return "Risk-off pressure is broad across equities and crypto.";
  if (oilGoldConfirmStress && equitiesWeak) return "Oil and gold are confirming geopolitical stress.";
  if (cryptoWeak && equitiesHolding) return "Crypto is weak, but equities are holding.";
  if (hasHeadlineRisk && isNegative(oil, -0.15) && isNegative(gold, -0.15) && equitiesHolding) {
    return "Markets are not confirming panic yet.";
  }
  if (repeatedTheme && marketConfirmationWeak) return "Repeated headline risk is elevated, but price action is mixed.";
  if (hasHeadlineRisk) return "Headline risk is elevated, but price action is mixed.";
  return "No urgent cross-asset stress confirmation yet.";
}

function getBestAction({
  confirmationStatus,
  marketMood,
  riskPosture,
}: {
  confirmationStatus: string;
  marketMood: MarketMood;
  riskPosture: RiskPosture;
}) {
  if (riskPosture === "Crisis" || riskPosture === "Defensive") return "Stay defensive until BTC and QQQ stabilize.";
  if (marketMood === "Risk-off") return "Reduce reaction speed and wait for confirmation.";
  if (/not confirming panic|mixed/i.test(confirmationStatus)) return "Watch, do not chase.";
  if (riskPosture === "Calm") return "Focus on execution; no urgent market action.";
  return "Wait for confirmation before changing posture.";
}

function getIgnoreLine({
  cryptoWeak,
  marketConfirmationWeak,
  repeatedTheme,
}: {
  cryptoWeak: boolean;
  marketConfirmationWeak: boolean;
  repeatedTheme: string;
}) {
  if (repeatedTheme && marketConfirmationWeak) return "Ignore repeated headlines without market confirmation.";
  if (cryptoWeak) return "Ignore small crypto moves unless BTC breaks direction.";
  return "Ignore single-source panic until confirmed by price action.";
}

function getWatchTriggers({
  btc,
  gold,
  qqq,
  repeatedTheme,
  riskScore,
  oil,
}: {
  btc: number;
  gold: number;
  qqq: number;
  repeatedTheme: string;
  riskScore?: number;
  oil: number;
}) {
  const triggers = [
    !isPositive(oil, 0.75) ? "Oil turns sharply positive" : "Oil strength persists",
    !isPositive(gold, 0.35) || !isNegative(qqq, -0.25) ? "Gold rises while equities fall" : "Gold strength broadens",
    !isNegative(btc, -3) ? "BTC drops more than 3%" : "BTC fails to recover",
    !isNegative(qqq, -0.7) ? "QQQ reverses lower" : "QQQ stays weak",
  ];

  if (typeof riskScore === "number" && Number.isFinite(riskScore)) {
    triggers.push(riskScore < 70 ? "Risk score crosses 70" : "Risk score stays above 70");
  }

  if (repeatedTheme) {
    triggers.push("Same theme spreads across 3+ major sources");
  }

  return uniqueValues(triggers).slice(0, 4);
}

function getRepeatedTheme(stories: IntelligenceStory[], changeInsights: ChangeInsight[]) {
  const insightTheme = changeInsights.find((insight) => insight.classification === "Repeated theme")?.text;
  if (insightTheme) return insightTheme;

  const repeatedStory = stories.find((story) => (story.sourceCount ?? story.coveredBy?.length ?? 1) >= 3);
  return repeatedStory?.title ?? "";
}

function hasRiskHeadline(stories: IntelligenceStory[]) {
  return stories.some((story) => {
    const text = `${story.section} ${story.title} ${story.summary} ${story.impact}`.toLowerCase();
    return /\b(war|conflict|sanction|military|oil|shipping|security|iran|hormuz|russia|ukraine|inflation|rates|central bank)\b/.test(text);
  });
}

function isAtLeast(value: number | undefined, threshold: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= threshold;
}

function isPositive(value: number, threshold: number) {
  return Number.isFinite(value) && value > threshold;
}

function isNegative(value: number, threshold: number) {
  return Number.isFinite(value) && value < threshold;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export { signalQualityMessage };
