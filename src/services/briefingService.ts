import { geopoliticalWatch, riskSignals, techSignals } from "@/data/mockData";
import { postBriefing } from "@/services/backendApi";
import { generateDailyBriefing as generateAIDailyBriefing, type AIDailyBriefing } from "@/services/aiBriefingService";
import { marketService as defaultMarketService, type MarketService } from "@/services/marketService";
import { memoryService as defaultMemoryService, type MemoryService, type PersonalPriorityMemory } from "@/services/memoryService";
import { newsService as defaultNewsService, type NewsItem, type NewsRiskLevel, type NewsService } from "@/services/newsService";
import type { BriefingMode, GeneratedBriefing } from "@/types/intel";

export type BriefingGlobalRisk = {
  score: number;
  level: NewsRiskLevel;
  posture: string;
  summary: string;
  drivers: string[];
};

export type Briefing = {
  aiBriefing: AIDailyBriefing;
  executiveSummary: string;
  globalRisk: BriefingGlobalRisk;
  topStories: NewsItem[];
  marketSummary: string;
  cryptoSummary: string;
  aiTechSummary: string;
  personalPriorities: PersonalPriorityMemory[];
  suggestedActions: string[];
};

export type BriefingRequest = {
  mode: BriefingMode;
  command?: string;
  localGreeting?: string;
};

export interface BriefingService {
  generateBriefing(request: BriefingRequest): Promise<Briefing>;
  generateDailyBriefing(request: BriefingRequest): Promise<GeneratedBriefing>;
}

export type BriefingServiceDependencies = {
  newsService: NewsService;
  marketService: MarketService;
  memoryService: MemoryService;
};

class NexusBriefingService implements BriefingService {
  constructor(private readonly dependencies: BriefingServiceDependencies) {}

  async generateBriefing({ mode, command = "", localGreeting }: BriefingRequest) {
    const [topStories, markets, marketSummary, userMemory] = await Promise.all([
      this.dependencies.newsService.getTopStories({ limit: mode === "quick" ? 3 : 5, minImportanceScore: 70 }),
      this.dependencies.marketService.getMarketSnapshot(),
      this.dependencies.marketService.getMarketSummary(),
      this.dependencies.memoryService.getUserMemory(),
    ]);

    const globalRisk = buildGlobalRisk();
    const aiBriefing = await generateAIDailyBriefing(command, topStories, markets, {
      ...userMemory.preferences,
      localGreeting,
      priorities: userMemory.priorities,
      suggestedActions: userMemory.suggestedActions,
    });

    return {
      aiBriefing,
      executiveSummary: aiBriefing.executiveSummary,
      globalRisk,
      topStories,
      marketSummary,
      cryptoSummary: aiBriefing.cryptoWatch,
      aiTechSummary: aiBriefing.aiTechSignals,
      personalPriorities: userMemory.priorities,
      suggestedActions: mode === "deep" ? aiBriefing.actionListForTheDay : aiBriefing.actionListForTheDay.slice(0, 2),
    };
  }

  async generateDailyBriefing(request: BriefingRequest) {
    try {
      const response = await postBriefing<GeneratedBriefing>(request);
      return response.data;
    } catch {
      const briefing = await this.generateBriefing(request);
      return mapBriefingToUiBriefing(briefing, request.mode);
    }
  }
}

function buildGlobalRisk(): BriefingGlobalRisk {
  const globalRisk = riskSignals[0];
  const level: NewsRiskLevel =
    globalRisk.value >= 80 ? "critical" : globalRisk.value >= 65 ? "high" : globalRisk.value >= 45 ? "medium" : "low";

  return {
    score: globalRisk.value,
    level,
    posture: globalRisk.posture,
    summary: globalRisk.description,
    drivers: riskSignals.slice(1).map((signal) => `${signal.label}: ${signal.description}`),
  };
}

function mapBriefingToUiBriefing(briefing: Briefing, mode: BriefingMode): GeneratedBriefing {
  const sections = [
    {
      title: "Greeting",
      items: [briefing.aiBriefing.greeting],
    },
    {
      title: "Executive Summary",
      items: [briefing.aiBriefing.executiveSummary],
    },
    {
      title: "World Situation",
      items: [briefing.aiBriefing.worldSituation],
    },
    {
      title: "Geopolitical Risk",
      items: [briefing.aiBriefing.geopoliticalRisk, `${geopoliticalWatch[0].region}: ${geopoliticalWatch[0].signal}`],
    },
    {
      title: "Market Snapshot",
      items: [briefing.aiBriefing.marketSnapshot],
    },
    {
      title: "Crypto Watch",
      items: [briefing.aiBriefing.cryptoWatch],
    },
    {
      title: "AI & Tech Signals",
      items: mode === "quick" ? [briefing.aiBriefing.aiTechSignals] : [briefing.aiBriefing.aiTechSignals, ...techSignals.slice(0, 2).map((signal) => `${signal.label}: ${signal.detail}`)],
    },
    {
      title: "Personal Priority Recommendation",
      items: [briefing.aiBriefing.personalPriorityRecommendation],
    },
    {
      title: "Action List For The Day",
      items: briefing.aiBriefing.actionListForTheDay,
    },
  ];

  if (mode === "deep") {
    sections.splice(1, 0, {
      title: "Decision Lens",
      items: [
        "Favor signals that combine price confirmation with clean positioning; fade crowded narratives without fresh flow.",
        "Treat geopolitics as a volatility amplifier. Translate each headline into supply, liquidity, or confidence impact.",
        "Keep today's personal system pointed at one memo-quality output before opening new research loops.",
      ],
    });
  }

  return {
    dataQuality: "Low",
    mode,
    generatedAt: new Date().toISOString(),
    headline:
      mode === "quick"
        ? "Morning signal: stay constructive, but keep liquidity and geopolitics on the main screen."
        : "Morning signal: AI-led risk appetite is intact, while macro and shipping risk argue for disciplined exposure.",
    sections: mode === "quick" ? sections.slice(0, 5) : sections,
  };
}

export function createBriefingService(
  dependencies: BriefingServiceDependencies = {
    newsService: defaultNewsService,
    marketService: defaultMarketService,
    memoryService: defaultMemoryService,
  },
): BriefingService {
  return new NexusBriefingService(dependencies);
}

export const briefingService = createBriefingService();
