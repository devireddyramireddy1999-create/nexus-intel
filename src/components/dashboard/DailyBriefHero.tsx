import { motion } from "framer-motion";
import { Cpu, Radar, ShieldAlert, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { riskSignals } from "@/data/mockData";
import type { GeneratedBriefing } from "@/types/intel";

type DailyBriefHeroProps = {
  briefing: GeneratedBriefing | null;
};

export function DailyBriefHero({ briefing }: DailyBriefHeroProps) {
  const globalRisk = riskSignals[0];

  return (
    <motion.section
      className="glass-card panel-line relative overflow-hidden rounded-lg p-5 sm:p-6"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-nexus-cyan to-transparent" />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge>NEXUS Daily Brief</Badge>
            <Badge variant="secondary">Local mock intelligence</Badge>
          </div>
          <h2 className="nexus-text-gradient break-words text-2xl font-semibold leading-tight tracking-normal sm:text-5xl sm:leading-tight">
            {briefing ? briefing.headline : "Command the morning signal before the market opens."}
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {briefing
              ? `Generated at ${briefing.generatedAt} in ${briefing.mode.replace("-", " ")} mode.`
              : "World news, geopolitics, markets, crypto, AI/tech, and personal priorities are staged for synthesis."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SignalMetric icon={Radar} label="Watchlist" value="18" />
            <SignalMetric icon={Cpu} label="AI Signals" value="92" />
            <SignalMetric icon={Zap} label="Priority Sync" value="84%" />
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-white/10 bg-black/[0.24] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Global Risk</p>
              <p className="mt-2 text-4xl font-semibold text-foreground">{globalRisk.value}</p>
            </div>
            <div className="flex size-14 items-center justify-center rounded-lg border border-nexus-ember/35 bg-nexus-ember/10 text-nexus-ember">
              <ShieldAlert className="size-7" />
            </div>
          </div>
          <Progress value={globalRisk.value} className="mt-5 h-3" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{globalRisk.description}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">Macro</div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">Cyber</div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">Transit</div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function SignalMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground sm:tracking-[0.2em]">
        <Icon className="size-4 text-nexus-cyan" />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
