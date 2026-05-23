import { useState } from "react";
import { BrainCircuit, Coins, Globe2, LayoutDashboard, ShieldAlert, Target } from "lucide-react";
import { BriefingOutput } from "@/components/dashboard/BriefingOutput";
import { CommandBar } from "@/components/dashboard/CommandBar";
import { DailyBriefHero } from "@/components/dashboard/DailyBriefHero";
import { MarketSnapshot } from "@/components/dashboard/MarketSnapshot";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RiskMeter } from "@/components/dashboard/RiskMeter";
import { SignalPanel } from "@/components/dashboard/SignalPanel";
import { TopStories } from "@/components/dashboard/TopStories";
import { formatLocalTime } from "@/lib/utils";
import { briefingService } from "@/services/briefingService";
import type { BriefingMode, GeneratedBriefing } from "@/types/intel";

const savedBriefingKey = "nexus-intel-last-briefing";

export function DashboardPage() {
  const [mode, setMode] = useState<BriefingMode>(() => readSavedBriefing()?.mode ?? "standard");
  const [briefing, setBriefing] = useState<GeneratedBriefing | null>(() => readSavedBriefing());
  const [commandError, setCommandError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavedBriefing, setIsSavedBriefing] = useState(() => Boolean(readSavedBriefing()));
  const [copied, setCopied] = useState(false);

  const generateBriefing = async (command: string, options: { localGreeting?: string } = {}) => {
    setIsGenerating(true);
    setCommandError("");
    setCopied(false);

    try {
      const nextBriefing = await briefingService.generateDailyBriefing({ mode, command, localGreeting: options.localGreeting });
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
      await navigator.clipboard.writeText(formatBriefingForClipboard(briefing));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCommandError("The brief could not be copied to the clipboard.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="NEXUS Intel"
        title="Personal Intelligence Dashboard"
        description="A daily command center for world news, geopolitics, markets, crypto, AI/tech, and priority execution."
        icon={LayoutDashboard}
        badge="PWA ready"
      />
      <CommandBar
        hasBriefing={Boolean(briefing)}
        mode={mode}
        onGenerateMorning={handleGenerateMorningBrief}
        onModeChange={setMode}
        onRefreshBrief={handleRefresh}
        onSubmit={handleCommand}
        isLoading={isGenerating}
      />

      <div className="grid gap-5">
        <DailyBriefHero briefing={briefing} />
        <MarketSnapshot />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <RiskMeter />
          <TopStories />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <SignalPanel title="Geopolitical Watch" eyebrow="Global Grid" icon={Globe2} variant="geo" />
          <SignalPanel title="AI & Tech Signals" eyebrow="Machine Layer" icon={BrainCircuit} variant="tech" />
          <SignalPanel title="Crypto Radar" eyebrow="On-Chain" icon={Coins} variant="crypto" />
          <SignalPanel title="Personal Priority Panel" eyebrow="Execution" icon={Target} variant="priority" />
        </div>

        <BriefingOutput
          briefing={briefing}
          error={commandError}
          isLoading={isGenerating}
          isSavedBriefing={isSavedBriefing}
          onClear={handleClearBrief}
          copied={copied}
          onCopy={handleCopyBrief}
          onRefresh={handleRefresh}
        />

        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          <MiniStatus label="Global posture" value="Elevated" icon={ShieldAlert} />
          <MiniStatus label="Briefing mode" value={mode === "deep" ? "Deep Dive" : mode === "quick" ? "Quick" : "Standard"} icon={LayoutDashboard} />
          <MiniStatus label="Priority load" value="3 active" icon={Target} />
        </div>
      </div>
    </>
  );
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

function formatBriefingForClipboard(briefing: GeneratedBriefing) {
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
    sections,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function MiniStatus({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="glass-card min-w-0 rounded-lg p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 break-words text-xs uppercase tracking-[0.2em] text-muted-foreground sm:tracking-[0.24em]">{label}</p>
        <Icon className="size-4 text-nexus-champagne" />
      </div>
      <p className="mt-3 break-words text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
