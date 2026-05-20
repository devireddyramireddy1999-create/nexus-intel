import { priorities } from "@/data/mockData";
import type { BriefingMode } from "@/types/intel";

export type PersonalPriorityMemory = {
  id: string;
  title: string;
  focus: string;
  nextAction: string;
  energy: number;
  due: string;
};

export type UserPreferenceMemory = {
  defaultBriefingMode: BriefingMode;
  preferredRegions: string[];
  preferredAssets: string[];
  riskTolerance: "conservative" | "balanced" | "aggressive";
};

export type UserMemory = {
  priorities: PersonalPriorityMemory[];
  preferences: UserPreferenceMemory;
  suggestedActions: string[];
};

export interface MemoryDataSource {
  fetchUserMemory(): Promise<UserMemory>;
  savePriority(priority: PersonalPriorityMemory): Promise<PersonalPriorityMemory>;
}

export interface MemoryService {
  getUserMemory(): Promise<UserMemory>;
  getPersonalPriorities(): Promise<PersonalPriorityMemory[]>;
  getSuggestedActions(): Promise<string[]>;
  upsertPriority(priority: PersonalPriorityMemory): Promise<PersonalPriorityMemory>;
}

const mockUserMemory: UserMemory = {
  priorities: priorities.map((priority, index) => ({
    id: `priority-${index + 1}`,
    title: priority.title,
    focus: priority.focus,
    nextAction: priority.nextAction,
    energy: priority.energy,
    due: priority.due,
  })),
  preferences: {
    defaultBriefingMode: "standard",
    preferredRegions: ["Indo-Pacific", "Middle East", "South Asia"],
    preferredAssets: ["SPX", "NDX", "BTC", "ETH", "USDINR"],
    riskTolerance: "balanced",
  },
  suggestedActions: [
    "Draft the strategy review memo before opening new research loops.",
    "Keep liquidity and geopolitics visible while sizing market exposure.",
    "Convert recurring AI research prompts into a reusable briefing template.",
  ],
};

class MockMemoryDataSource implements MemoryDataSource {
  private memory = structuredClone(mockUserMemory);

  async fetchUserMemory() {
    return structuredClone(this.memory);
  }

  async savePriority(priority: PersonalPriorityMemory) {
    const index = this.memory.priorities.findIndex((item) => item.id === priority.id);
    if (index >= 0) {
      this.memory.priorities[index] = priority;
    } else {
      this.memory.priorities.push(priority);
    }

    return structuredClone(priority);
  }
}

class NexusMemoryService implements MemoryService {
  constructor(private readonly dataSource: MemoryDataSource) {}

  async getUserMemory() {
    return this.dataSource.fetchUserMemory();
  }

  async getPersonalPriorities() {
    const memory = await this.getUserMemory();
    return memory.priorities;
  }

  async getSuggestedActions() {
    const memory = await this.getUserMemory();
    return memory.suggestedActions;
  }

  async upsertPriority(priority: PersonalPriorityMemory) {
    return this.dataSource.savePriority(priority);
  }
}

export function createMemoryService(dataSource: MemoryDataSource = new MockMemoryDataSource()): MemoryService {
  return new NexusMemoryService(dataSource);
}

export const memoryService = createMemoryService();
