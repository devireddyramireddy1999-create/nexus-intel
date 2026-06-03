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
  const avoid = context.thingsToAvoid ? formatReadableList(context.thingsToAvoid) : judgment.whatToIgnore;

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
  const avoid = context.thingsToAvoid ? formatReadableList(context.thingsToAvoid) : judgment.whatToIgnore;

  return [
    `Focus: ${priority}`,
    `Ignore: ${avoid}`,
    `Action: ${buildPersonalAction(context, judgment)}`,
    `Next step: ${buildNextStep(context)}`,
  ];
}

function buildPersonalAction(context: PersonalContext, judgment: NexusJudgment) {
  const project = context.currentPrimaryProject || context.workSchoolPriority || context.mainLifeGoal || "your highest-value work";
  const judgmentAction = ensureSentence(judgment.bestAction);

  if (judgment.riskPosture === "Crisis" || judgment.riskPosture === "Defensive") {
    if (context.financialPriority) {
      return `${judgmentAction} Follow your financial rule: ${formatActionClause(context.financialPriority)}.`;
    }

    return `${judgmentAction} Keep financial decisions disciplined and protect the next focus block.`;
  }

  if (judgment.marketMood === "Mixed" || judgment.marketMood === "Unclear") {
    return `No urgent market action. Spend one focused block on ${project}.`;
  }

  return `${judgmentAction} Put the next focus block into ${project}.`;
}

function buildPersonalImpact(context: PersonalContext, judgment: NexusJudgment) {
  if (judgment.riskPosture === "Calm" || judgment.riskPosture === "Watchful") {
    return "Market/news risk does not require immediate action; keep the day pointed at execution.";
  }

  if (context.financialPriority) {
    return `${ensureSentence(judgment.confirmationStatus)} Your financial rule is to ${formatActionClause(context.financialPriority)}.`;
  }

  return `${judgment.confirmationStatus} Treat this as directional, not a reason to overreact.`;
}

function buildFocusBlock(project: string, scheduleNote: string) {
  const focus = buildFocusPhrase(project);

  if (/limited time|work|school|busy|class|shift/i.test(scheduleNote)) {
    return `45 minutes: ${focus}. Do not check headlines until one concrete step is finished.`;
  }

  return `45 minutes: ${focus}. Finish one visible improvement.`;
}

function buildNextStep(context: PersonalContext) {
  const project = context.currentPrimaryProject || context.workSchoolPriority || context.mainLifeGoal || "your main priority";
  if (context.currentScheduleNote) {
    return `Protect one 45-minute block for ${project}.`;
  }

  return `Pick one measurable improvement for ${project}.`;
}

function formatReadableList(value: string) {
  const items = splitContextItems(value).map(normalizeAvoidItem).filter(Boolean);
  if (!items.length) return "Avoid running the day from headlines alone.";
  if (items.length === 1) return `Avoid ${items[0]}.`;
  if (items.length === 2) return `Avoid ${items[0]} and ${items[1]}.`;

  return `Avoid ${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}.`;
}

function formatActionClause(value: string) {
  const text = stripSentenceEnd(splitContextItems(value).join(", "));
  if (!text) return "stay disciplined";

  return text.charAt(0).toLowerCase() + text.slice(1);
}

function splitContextItems(value: string) {
  const cleaned = stripSentenceEnd(value)
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*;\s*/g, "; ")
    .trim();

  return cleaned
    .split(/[,;\n]+/)
    .map((item) => stripSentenceEnd(item).trim())
    .filter(Boolean);
}

function ensureSentence(value: string) {
  const text = value.trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function stripSentenceEnd(value: string) {
  return value.trim().replace(/[.!?]+$/g, "");
}

function normalizeAvoidItem(value: string) {
  return value
    .replace(/\b(and|or)\s+\1\b/gi, "$1")
    .replace(/^avoid\s+/i, "")
    .replace(/^(and|or)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function buildFocusPhrase(project: string) {
  const text = stripSentenceEnd(project).replace(/\s+/g, " ").trim();
  if (!text) return "advance one priority detail";

  const nexusMatch = text.match(/\bNEXUS\b/i);
  if (nexusMatch) {
    if (/mobile|command brief|brief/i.test(text)) return "improve one NEXUS command brief detail";
    return "advance one NEXUS decision-intelligence detail";
  }

  const words = text.split(" ").slice(0, 6).join(" ");
  return `advance one ${words} detail`;
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
