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
  change: number;
  category: "Index" | "Crypto" | "Commodity" | "FX";
  note: string;
  fallback?: boolean;
  proxySymbol?: string;
  series: TrendPoint[];
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

export type GeneratedBriefing = {
  mode: BriefingMode;
  generatedAt: string;
  headline: string;
  sections: BriefingSection[];
};
