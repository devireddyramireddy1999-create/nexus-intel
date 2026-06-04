import { useEffect, useState } from "react";
import { BrainCircuit, Coins, Globe2, LayoutDashboard, Target } from "lucide-react";
import { BriefingOutput } from "@/components/dashboard/BriefingOutput";
import { CommandBar } from "@/components/dashboard/CommandBar";
import { DailyBriefHero } from "@/components/dashboard/DailyBriefHero";
import { CarryForwardCard, EndOfDayDebriefCard } from "@/components/dashboard/EndOfDayDebriefCard";
import { MarketSnapshot } from "@/components/dashboard/MarketSnapshot";
import { NexusJudgmentCard } from "@/components/dashboard/NexusJudgmentCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PersonalReadCard } from "@/components/dashboard/PersonalReadCard";
import { RiskMeter } from "@/components/dashboard/RiskMeter";
import { SignalPanel } from "@/components/dashboard/SignalPanel";
import { SmartAlertsCard } from "@/components/dashboard/SmartAlertsCard";
import { TopStories } from "@/components/dashboard/TopStories";
import { formatLocalTime } from "@/lib/utils";
import { briefingService } from "@/services/briefingService";
import { CHANGE_INTELLIGENCE_EVENT, getChangeInsights } from "@/services/changeIntelligenceService";
import { getPersonalContext } from "@/services/personalContextService";
import type { BriefingMode, ChangeInsight, GeneratedBriefing } from "@/types/intel";

const savedBriefingKey = "nexus-intel-last-briefing";

export function DashboardPage() {
  const [mode, setMode] = useState<BriefingMode>(() => readSavedBriefing()?.mode ?? "standard");
  const [briefing, setBriefing] = useState<GeneratedBriefing | null>(() => readSavedBriefing());
  const [commandError, setCommandError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavedBriefing, setIsSavedBriefing] = useState(() => Boolean(readSavedBriefing()));
  const [copied, setCopied] = useState(false);
  const [changeInsights, setChangeInsights] = useState<ChangeInsight[]>(() => getChangeInsights());

  useEffect(() => {
    const handleChangeIntelligence = () => {
      setChangeInsights(getChangeInsights());
    };

    window.addEventListener(CHANGE_INTELLIGENCE_EVENT, handleChangeIntelligence);
    return () => window.removeEventListener(CHANGE_INTELLIGENCE_EVENT, handleChangeIntelligence);
  }, []);

  const generateBriefing = async (command: string, options: { localGreeting?: string } = {}) => {
    setIsGenerating(true);
    setCommandError("");
    setCopied(false);

    try {
      const nextBriefing = await briefingService.generateDailyBriefing({
        mode,
        command,
        localGreeting: options.localGreeting,
        personalContext: getPersonalContext(),
      });
      setBriefing(nextBriefing);
      setIsSavedBriefing(false);
      saveBriefing(nextBriefing);
    } catch {
      setCommandError("The briefing service could not generate a briefing from the current data source.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommand = async (command: string) => {
    const normalized = normalizeCommand(command);
    if (!normalized) {
      await handleGenerateMorningBrief();
      return;
    }

    await generateBriefing(command.trim(), { localGreeting: getLocalGreeting() });
  };

  const handleGenerateMorningBrief = async () => {
    await generateBriefing("Generate Morning Brief", { localGreeting: getLocalGreeting() });
  };

  const handleRefresh = async () => {
    await generateBriefing("Refresh Brief", { localGreeting: getLocalGreeting() });
  };

  const handleClearBrief = () => {
    clearSavedBriefing();
    setBriefing(null);
    setIsSavedBriefing(false);
    setCopied(false);
    setCommandError("");
  };

  const handleCopyBrief = async () => {
    if (!briefing) return;

    try {
      await navigator.clipboard.writeText(formatBriefingForClipboard(briefing, changeInsights));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCommandError("The brief could not be copied to the clipboard.");
    }
  };

  const topChangeInsights = selectCommandBriefInsights(changeInsights);
  const hasBriefing = Boolean(briefing);

  return (
    <>
      <PageHeader
        eyebrow="NEXUS Intel"
        title="Daily Command Brief"
        description="What changed, what matters, and what to do next."
        icon={LayoutDashboard}
        badge="PWA ready"
      />

      <div className="grid gap-5">
        <section aria-label="Daily command ritual" className="grid min-w-0 gap-5">
          <div className={hasBriefing ? "order-7 min-w-0 sm:order-1" : "order-1 min-w-0"}>
            <CommandBar
              hasBriefing={hasBriefing}
              mode={mode}
              onGenerateMorning={handleGenerateMorningBrief}
              onModeChange={setMode}
              onRefreshBrief={handleRefresh}
              onSubmit={handleCommand}
              isLoading={isGenerating}
            />
          </div>
          <div className={hasBriefing ? "order-1 min-w-0 sm:order-2" : "order-2 min-w-0"}>
            <DailyBriefHero briefing={briefing} mode={mode} />
          </div>
          <div className={hasBriefing ? "glass-card order-2 min-w-0 rounded-lg p-4 sm:order-3 sm:p-5" : "glass-card order-3 min-w-0 rounded-lg p-4 sm:p-5"}>
            <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-xs font-semibold uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
                  What Changed
                </p>
                <h2 className="mt-1 break-words text-lg font-semibold text-foreground">Latest movement since the last snapshot</h2>
              </div>
              <span className="shrink-0 rounded-md border border-primary/[0.18] bg-[#0a0a0a]/75 px-3 py-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Top signals
              </span>
            </div>
            {topChangeInsights.length ? (
              <ul className="grid min-w-0 gap-2 lg:grid-cols-3">
                {topChangeInsights.map((insight) => (
                  <li
                    key={`${insight.classification}-${insight.text}`}
                    className="min-w-0 rounded-md border border-primary/[0.14] bg-[#0a0a0a]/75 p-3 text-sm leading-6 text-foreground"
                  >
                    <p className="mb-1 break-words text-xs font-semibold uppercase tracking-[0.16em] text-primary">{insight.label}</p>
                    <p className="min-w-0 break-words text-muted-foreground">{insight.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="break-words text-sm leading-6 text-muted-foreground">
                Warming the comparison layer. NEXUS will summarize meaningful changes after the first live snapshot.
              </p>
            )}
          </div>
          <div className={hasBriefing ? "order-3 min-w-0 sm:order-4" : "order-4 min-w-0"}>
            <NexusJudgmentCard changeInsights={changeInsights} />
          </div>
          <div className={hasBriefing ? "order-4 min-w-0 sm:order-5" : "order-5 min-w-0"}>
            <PersonalReadCard changeInsights={changeInsights} />
          </div>
          <div className={hasBriefing ? "order-5 min-w-0 sm:order-6" : "order-6 min-w-0"}>
            <CarryForwardCard />
          </div>
          <div className={hasBriefing ? "order-6 min-w-0 sm:order-7" : "order-7 min-w-0"}>
            <EndOfDayDebriefCard />
          </div>
        </section>

        <SmartAlertsCard changeInsights={changeInsights} />
        <MarketSnapshot />

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
            <div className="order-1 min-w-0 xl:order-none">
              <RiskMeter />
            </div>
            <div className="order-3 min-w-0 xl:order-none">
              <SignalPanel title="Geopolitical Watch" eyebrow="Global Grid" icon={Globe2} variant="geo" />
            </div>
            <div className="order-4 min-w-0 xl:order-none">
              <SignalPanel title="Crypto Radar" eyebrow="On-Chain" icon={Coins} variant="crypto" />
            </div>
            <div className="order-5 min-w-0 xl:order-none">
              <SignalPanel title="AI & Tech Signals" eyebrow="Machine Layer" icon={BrainCircuit} variant="tech" />
            </div>
          </div>

          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
            <div className="order-2 min-w-0 xl:order-none">
              <TopStories />
            </div>
          </div>
        </div>

        <SignalPanel title="Sample Priority Stack" eyebrow="Local Priorities" icon={Target} variant="priority" />

        <BriefingOutput
          briefing={briefing}
          changeInsights={changeInsights}
          error={commandError}
          isLoading={isGenerating}
          isSavedBriefing={isSavedBriefing}
          onClear={handleClearBrief}
          copied={copied}
          onCopy={handleCopyBrief}
          onRefresh={handleRefresh}
        />
      </div>
    </>
  );
}

type CommandBriefInsight = ChangeInsight & {
  label: string;
};

function selectCommandBriefInsights(insights: ChangeInsight[]): CommandBriefInsight[] {
  const ranked = insights
    .map((insight, index) => ({
      ...formatCommandBriefInsight(insight),
      score: scoreChangeInsight(insight) - index * 0.01,
    }))
    .sort((a, b) => b.score - a.score);

  const useful = ranked.filter((insight) => !isLowValueChangeInsight(insight));
  const selected = uniqueChangeInsights(useful.length ? useful : ranked);

  return selected.slice(0, 3).map(({ score: _score, ...insight }) => insight);
}

function formatCommandBriefInsight(insight: ChangeInsight): CommandBriefInsight {
  return {
    ...insight,
    label: getCommandBriefLabel(insight),
    text: sharpenChangeInsightText(insight.text),
  };
}

function scoreChangeInsight(insight: ChangeInsight) {
  let score = 0;

  if (insight.classification === "Worsened") score += 100;
  if (insight.classification === "Improved") score += 95;
  if (insight.classification === "Repeated theme") score += 90;
  if (insight.classification === "New") score += 80;
  if (insight.classification === "Unchanged") score += 45;

  if (isMarketConfirmationInsight(insight.text)) score += 28;
  if (isRiskSignalInsight(insight.text)) score += 22;
  if (isLowValueChangeInsight(insight)) score -= 80;

  return score;
}

function getCommandBriefLabel(insight: ChangeInsight) {
  if (isMarketConfirmationInsight(insight.text)) return "Market confirmation";
  if (isRiskSignalInsight(insight.text)) return "Risk signal";
  if (insight.classification === "Repeated theme") return "Repeated theme";
  return insight.classification;
}

function sharpenChangeInsightText(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (/^crypto improved; confirm btc and eth before adding risk\.?$/i.test(cleaned)) {
    return "Crypto improved, but wait for BTC/ETH confirmation before adding risk.";
  }

  if (/^no dominant repeated theme yet\.?$/i.test(cleaned)) {
    return "No dominant repeated theme yet; treat headline noise as background until price action confirms.";
  }

  if (/^nexus will compare the next refresh against this state\.?$/i.test(cleaned)) {
    return "Baseline is set; the next refresh will show what materially changed.";
  }

  return cleaned;
}

function isMarketConfirmationInsight(text: string) {
  return /\b(market confirmation|not confirming|price confirmation|price action|risk appetite|equities|spy|qqq|btc|eth|crypto|oil|gold)\b/i.test(text);
}

function isRiskSignalInsight(text: string) {
  return /\b(risk rose|risk eased|risk is|signal quality|directional|geopolitical|usd\/inr|dollar pressure|safe-haven)\b/i.test(text);
}

function isLowValueChangeInsight(insight: Pick<ChangeInsight, "classification" | "text">) {
  const text = insight.text.toLowerCase();
  if (/no dominant repeated theme yet/.test(text)) return true;
  if (/nexus will compare the next refresh/.test(text)) return true;
  if (insight.classification === "Unchanged" && /saved for the next comparison|current market, crypto, risk/.test(text)) return true;
  return false;
}

function uniqueChangeInsights<T extends Pick<ChangeInsight, "classification" | "text">>(insights: T[]) {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    const key = `${insight.classification}:${insight.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function getLocalGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning, Ram.";
  if (hour < 17) return "Good afternoon, Ram.";
  return "Good evening, Ram.";
}

function readSavedBriefing() {
  try {
    const raw = window.localStorage.getItem(savedBriefingKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GeneratedBriefing;
    if (!parsed?.generatedAt || !parsed.headline || !Array.isArray(parsed.sections)) return null;

    return parsed;
  } catch {
    return null;
  }
}

function saveBriefing(briefing: GeneratedBriefing) {
  try {
    window.localStorage.setItem(savedBriefingKey, JSON.stringify(briefing));
  } catch {
    // localStorage may be unavailable in private or restricted browser modes.
  }
}

function clearSavedBriefing() {
  window.localStorage.removeItem(savedBriefingKey);
}

function formatBriefingForClipboard(briefing: GeneratedBriefing, changeInsights: ChangeInsight[] = []) {
  const changes = changeInsights.length
    ? `What Changed\n${changeInsights.map((insight) => `- ${insight.classification}: ${insight.text}`).join("\n")}`
    : "";
  const sections = briefing.sections
    .map((section) => {
      const items = section.items.map((item) => `- ${item}`).join("\n");
      return `${section.title}\n${items}`;
    })
    .join("\n\n");

  return [
    `NEXUS Daily Brief`,
    `Generated: ${formatLocalTime(briefing.generatedAt)}`,
    `Mode: ${briefing.mode}`,
    briefing.dataQuality ? `Data quality: ${briefing.dataQuality}` : "",
    briefing.headline,
    changes,
    sections,
  ]
    .filter(Boolean)
    .join("\n\n");
}
