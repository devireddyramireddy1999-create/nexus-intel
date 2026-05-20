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
import { briefingService } from "@/services/briefingService";
import type { BriefingMode, GeneratedBriefing } from "@/types/intel";

export function DashboardPage() {
  const [mode, setMode] = useState<BriefingMode>("standard");
  const [briefing, setBriefing] = useState<GeneratedBriefing | null>(null);
  const [commandError, setCommandError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastBriefCommand, setLastBriefCommand] = useState("");
  const [copied, setCopied] = useState(false);

  const generateBriefing = async (command: string) => {
    setIsGenerating(true);
    setCommandError("");
    setCopied(false);

    try {
      const nextBriefing = await briefingService.generateDailyBriefing({ mode, command });
      setBriefing(nextBriefing);
      setLastBriefCommand(command);
    } catch {
      setCommandError("The briefing service could not generate a briefing from the current data source.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommand = async (command: string) => {
    const normalized = normalizeCommand(command);
    if (normalized === "good morning") {
      await generateBriefing(command.trim());
      return;
    }

    setCommandError("Command not recognized by the local briefing core.");
  };

  const handleRefresh = async () => {
    if (!briefing) return;
    await generateBriefing(lastBriefCommand || "Good morning");
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
      <CommandBar mode={mode} onModeChange={setMode} onSubmit={handleCommand} isLoading={isGenerating} />

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

function formatBriefingForClipboard(briefing: GeneratedBriefing) {
  const sections = briefing.sections
    .map((section) => {
      const items = section.items.map((item) => `- ${item}`).join("\n");
      return `${section.title}\n${items}`;
    })
    .join("\n\n");

  return [`NEXUS Daily Brief`, `Generated: ${briefing.generatedAt}`, `Mode: ${briefing.mode}`, briefing.headline, sections].join("\n\n");
}

function MiniStatus({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="glass-card min-w-0 rounded-lg p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 break-words text-xs uppercase tracking-[0.2em] text-muted-foreground sm:tracking-[0.24em]">{label}</p>
        <Icon className="size-4 text-nexus-cyan" />
      </div>
      <p className="mt-3 break-words text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
