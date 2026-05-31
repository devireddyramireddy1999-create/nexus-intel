import type { NexusJudgment, PersonalContext, PersonalRead } from "@/types/intel";

const personalContextKey = "nexus-personal-context:v1";
export const PERSONAL_CONTEXT_EVENT = "nexus-personal-context-updated";
export const emptyPersonalContext: PersonalContext = {
  currentPrimaryProject: "",
  currentScheduleNote: "",
  financialPriority: "",
  fitnessHealthPriority: "",
  mainLifeGoal: "",
  personalWatchlist: "",
  thingsToAvoid: "",
  workSchoolPriority: "",
};

export function getPersonalContext(): PersonalContext {
  if (typeof window === "undefined") return emptyPersonalContext;

  try {
    const raw = window.localStorage.getItem(personalContextKey);
    if (!raw) return emptyPersonalContext;

    return normalizePersonalContext(JSON.parse(raw));
  } catch {
    return emptyPersonalContext;
  }
}

export function savePersonalContext(context: PersonalContext) {
  if (typeof window === "undefined") return;

  const normalized = normalizePersonalContext(context);
  window.localStorage.setItem(personalContextKey, JSON.stringify(normalized));
  notifyPersonalContextChange();
}

export function clearPersonalContext() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(personalContextKey);
  notifyPersonalContextChange();
}

export function hasPersonalContext(context: PersonalContext) {
  return Object.values(context).some((value) => value.trim().length > 0);
}

export function buildPersonalRead(context: PersonalContext, judgment: NexusJudgment): PersonalRead {
  if (!hasPersonalContext(context)) {
    return {
      priority: "Personal context is not set yet. Add your goals to unlock personalized reads.",
      bestAction: "Set your main goal and current project first.",
      thingToAvoid: "Avoid running the day from headlines alone.",
      impact: "NEXUS needs your goals before it can connect risk to your priorities.",
      focusBlock: "Add Personal Context in Settings.",
    };
  }

  const priority = context.workSchoolPriority || context.currentPrimaryProject || context.mainLifeGoal;
  const project = context.currentPrimaryProject || context.mainLifeGoal || "your highest-value project";
  const avoid = context.thingsToAvoid || judgment.whatToIgnore;

  return {
    priority,
    bestAction: buildPersonalAction(context, judgment),
    thingToAvoid: avoid,
    impact: buildPersonalImpact(context, judgment),
    focusBlock: buildFocusBlock(project, context.currentScheduleNote),
  };
}

export function formatPersonalCommandItems(context: PersonalContext, judgment: NexusJudgment) {
  if (!hasPersonalContext(context)) {
    return ["Personal context is not set yet. Add your goals to unlock personalized reads."];
  }

  const priority = context.currentPrimaryProject || context.workSchoolPriority || context.mainLifeGoal;
  const avoid = context.thingsToAvoid || judgment.whatToIgnore;

  return [
    `Focus: ${priority}`,
    `Ignore: ${avoid}`,
    `Action: ${buildPersonalAction(context, judgment)}`,
    `Next step: ${buildNextStep(context)}`,
  ];
}

function buildPersonalAction(context: PersonalContext, judgment: NexusJudgment) {
  if (judgment.riskPosture === "Crisis" || judgment.riskPosture === "Defensive") {
    return `${judgment.bestAction} Keep ${context.financialPriority || "financial decisions"} disciplined.`;
  }

  if (judgment.marketMood === "Mixed" || judgment.marketMood === "Unclear") {
    return `No urgent market action. Use the session for ${context.currentPrimaryProject || context.workSchoolPriority || "focused execution"}.`;
  }

  return `${judgment.bestAction} Prioritize ${context.currentPrimaryProject || context.workSchoolPriority || "the main goal"}.`;
}

function buildPersonalImpact(context: PersonalContext, judgment: NexusJudgment) {
  if (judgment.riskPosture === "Calm" || judgment.riskPosture === "Watchful") {
    return "Market/news risk does not require immediate action; keep the day pointed at execution.";
  }

  if (context.financialPriority) {
    return `${judgment.confirmationStatus} ${context.financialPriority}`;
  }

  return `${judgment.confirmationStatus} Treat this as directional, not a reason to overreact.`;
}

function buildFocusBlock(project: string, scheduleNote: string) {
  if (/limited time|work|school|busy|class|shift/i.test(scheduleNote)) {
    return `45 minutes on ${project} before checking more headlines.`;
  }

  return `45 minutes testing or advancing ${project}.`;
}

function buildNextStep(context: PersonalContext) {
  const project = context.currentPrimaryProject || context.workSchoolPriority || context.mainLifeGoal || "your main priority";
  if (context.currentScheduleNote) {
    return `Protect one 45-minute block for ${project}.`;
  }

  return `Pick one measurable improvement for ${project}.`;
}

function normalizePersonalContext(value: unknown): PersonalContext {
  const source = value && typeof value === "object" ? value as Partial<Record<keyof PersonalContext, unknown>> : {};

  return {
    currentPrimaryProject: cleanField(source.currentPrimaryProject),
    currentScheduleNote: cleanField(source.currentScheduleNote),
    financialPriority: cleanField(source.financialPriority),
    fitnessHealthPriority: cleanField(source.fitnessHealthPriority),
    mainLifeGoal: cleanField(source.mainLifeGoal),
    personalWatchlist: cleanField(source.personalWatchlist),
    thingsToAvoid: cleanField(source.thingsToAvoid),
    workSchoolPriority: cleanField(source.workSchoolPriority),
  };
}

function cleanField(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function notifyPersonalContextChange() {
  window.dispatchEvent(new CustomEvent(PERSONAL_CONTEXT_EVENT, { detail: getPersonalContext() }));
}
