import type { LucideIcon } from "lucide-react";

export type PageKey = "dashboard" | "markets" | "geopolitics" | "crypto" | "ai-tech" | "priorities" | "settings";

export type NavItem = {
  key: PageKey;
  label: string;
  icon: LucideIcon;
};

export type BriefingMode = "quick" | "standard" | "deep";

export type TrendPoint = {
  time: string;
  value: number;
};

export type MarketAsset = {
  symbol: string;
  name: string;
  value: string;
  price?: number;
  change: number;
  changeAvailable?: boolean;
  changeSource?: string;
  category: "Index" | "Crypto" | "Commodity" | "FX";
  note: string;
  fallback?: boolean;
  proxySymbol?: string;
  series: TrendPoint[];
  seriesSource?: string;
  source?: string;
};

export type IntelligenceStory = {
  id: string;
  section: "World" | "Markets" | "Geopolitics" | "AI & Tech" | "Crypto";
  title: string;
  summary: string;
  impact: string;
  sentiment: "bullish" | "neutral" | "caution" | "risk";
  confidence: number;
  publishedAt?: string;
  source?: string;
  sourceType?: "rss" | "fallback";
  url?: string;
  coveredBy?: string[];
  sourceCount?: number;
};

export type RiskSignal = {
  label: string;
  value: number;
  posture: "low" | "guarded" | "elevated" | "critical";
  description: string;
};

export type WatchItem = {
  region: string;
  title: string;
  signal: string;
  severity: "Low" | "Medium" | "High";
};

export type TechSignal = {
  label: string;
  title: string;
  detail: string;
  velocity: number;
};

export type CryptoSignal = {
  asset: string;
  thesis: string;
  flow: string;
  risk: string;
  score: number;
};

export type Priority = {
  title: string;
  focus: string;
  nextAction: string;
  energy: number;
  due: string;
};

export type BriefingSection = {
  title: string;
  items: string[];
};

export type ChangeClassification = "New" | "Improved" | "Worsened" | "Unchanged" | "Repeated theme";

export type ChangeInsight = {
  classification: ChangeClassification;
  text: string;
};

export type RiskPosture = "Calm" | "Watchful" | "Elevated" | "Defensive" | "Crisis";

export type MarketMood = "Risk-on" | "Mixed" | "Risk-off" | "Defensive" | "Unclear";

export type NexusJudgment = {
  bestAction: string;
  confirmationStatus: string;
  marketMood: MarketMood;
  riskPosture: RiskPosture;
  watchTriggers: string[];
  whatToIgnore: string;
};

export type PersonalContext = {
  currentPrimaryProject: string;
  currentScheduleNote: string;
  financialPriority: string;
  fitnessHealthPriority: string;
  mainLifeGoal: string;
  personalWatchlist: string;
  thingsToAvoid: string;
  workSchoolPriority: string;
};

export type PersonalRead = {
  bestAction: string;
  focusBlock: string;
  impact: string;
  priority: string;
  thingToAvoid: string;
};

export type GeneratedBriefing = {
  dataQuality?: string;
  mode: BriefingMode;
  generatedAt: string;
  headline: string;
  sections: BriefingSection[];
};
