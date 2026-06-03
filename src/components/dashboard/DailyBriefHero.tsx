import { motion } from "framer-motion";
import { Clock3, FileText, Gauge, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatLocalTime } from "@/lib/utils";
import type { BriefingMode, GeneratedBriefing } from "@/types/intel";

type DailyBriefHeroProps = {
  briefing: GeneratedBriefing | null;
  mode: BriefingMode;
};

export function DailyBriefHero({ briefing, mode }: DailyBriefHeroProps) {
  const generatedTime = briefing ? formatLocalTime(briefing.generatedAt) : "";
  const activeMode = briefing?.mode ?? mode;
  const briefStatus = briefing ? "Generated" : "Ready";
  const dataQuality = briefing?.dataQuality ?? "Pending";
  const generatedLabel = briefing ? generatedTime : "Not yet";

  return (
    <motion.section
      className="glass-card panel-line relative overflow-hidden rounded-lg p-4 sm:p-6"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-nexus-champagne to-transparent" />
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
            <Badge>Morning Command Brief</Badge>
            <Badge variant={briefing ? "default" : "secondary"}>{briefing ? "Brief generated" : "Ready to generate"}</Badge>
          </div>
          <h2 className="nexus-text-gradient break-words text-xl font-semibold leading-tight tracking-normal sm:text-5xl sm:leading-tight">
            {briefing ? briefing.headline : "Start the Daily Command Brief."}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:mt-4 sm:text-base">
            {briefing
              ? `Generated at ${generatedTime} in ${briefing.mode.replace("-", " ")} mode.`
              : "Generate the brief to see what changed, what matters, and the next action."}
          </p>

          <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
            <SignalMetric icon={RadioTower} label="Brief Status" value={briefStatus} />
            <SignalMetric icon={Gauge} label="Mode" value={formatMode(activeMode)} />
            <SignalMetric icon={FileText} label="Data Quality" value={dataQuality} />
          </div>
        </div>

        <div className="hidden min-w-0 rounded-lg border border-primary/15 bg-black/[0.3] p-4 sm:block">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Last Generated</p>
              <p className="mt-2 break-words text-3xl font-semibold text-foreground sm:text-4xl">{generatedLabel}</p>
            </div>
            <div className="flex size-14 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <Clock3 className="size-7" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {briefing ? "The latest command brief is ready for review." : "Generate once when you are ready; NEXUS will not spend credits automatically."}
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function formatMode(mode: BriefingMode) {
  if (mode === "deep") return "Deep";
  if (mode === "quick") return "Quick";
  return "Standard";
}

function SignalMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-primary/[0.14] bg-[#0a0a0a]/70 px-3 py-2 sm:block sm:rounded-lg sm:p-3">
      <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground sm:tracking-[0.2em]">
        <Icon className="size-4 text-nexus-champagne" />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <p className="shrink-0 text-sm font-semibold text-foreground sm:mt-2 sm:text-2xl">{value}</p>
    </div>
  );
}
