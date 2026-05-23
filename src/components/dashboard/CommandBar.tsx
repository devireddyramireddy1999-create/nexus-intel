import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Command, Loader2, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BriefingMode } from "@/types/intel";

type CommandBarProps = {
  isLoading?: boolean;
  mode: BriefingMode;
  onGenerateMorning: () => void | Promise<void>;
  onModeChange: (mode: BriefingMode) => void;
  onRefreshBrief: () => void | Promise<void>;
  onSubmit: (command: string) => void | Promise<void>;
  hasBriefing?: boolean;
};

const modes: { key: BriefingMode; label: string; shortLabel: string }[] = [
  { key: "quick", label: "Quick Brief", shortLabel: "Quick" },
  { key: "standard", label: "Standard Brief", shortLabel: "Standard" },
  { key: "deep", label: "Deep Dive", shortLabel: "Deep" },
];

export function CommandBar({
  hasBriefing = false,
  isLoading = false,
  mode,
  onGenerateMorning,
  onModeChange,
  onRefreshBrief,
  onSubmit,
}: CommandBarProps) {
  const [value, setValue] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(value);
    setValue("");
  };

  const selectedMode = modes.find((item) => item.key === mode) ?? modes[1];

  return (
    <motion.section
      className="glass-card panel-line mb-5 rounded-lg p-3 sm:p-4"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <div className="grid min-w-0 grid-cols-[1.35fr_0.8fr] gap-2 lg:flex lg:shrink-0">
            <Button type="button" className="h-11 min-w-0 whitespace-normal lg:h-10" onClick={onGenerateMorning} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate Brief
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 min-w-0 whitespace-normal px-3 lg:h-10"
              onClick={onRefreshBrief}
              disabled={!hasBriefing || isLoading}
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-primary/[0.14] bg-[#050505]/55 px-2 py-2 lg:w-auto lg:min-w-[19rem]">
            <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <SlidersHorizontal className="size-3.5 shrink-0 text-nexus-champagne" />
              <span className="hidden min-[380px]:inline">Mode</span>
              <span className="min-[380px]:hidden">{selectedMode.shortLabel}</span>
            </div>
            <select
              value={mode}
              onChange={(event) => onModeChange(event.target.value as BriefingMode)}
              className="h-9 min-w-0 rounded-md border border-primary/[0.18] bg-[#050505] px-3 text-sm font-medium text-nexus-platinum outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="Briefing mode"
              disabled={isLoading}
            >
              {modes.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.shortLabel}
                </option>
              ))}
            </select>
            <div className="hidden min-w-0 rounded-md border border-primary/[0.14] bg-[#030303] p-1 md:grid md:grid-cols-3">
              {modes.map((item) => {
                const active = mode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "min-w-0 rounded px-3 py-1.5 text-xs font-medium text-muted-foreground transition",
                      "hover:bg-white/[0.035] hover:text-nexus-platinum",
                      active && "bg-[#0b0a07] text-nexus-champagne shadow-[inset_0_0_0_1px_rgba(201,166,70,0.22)]",
                    )}
                    onClick={() => onModeChange(item.key)}
                    disabled={isLoading}
                    aria-pressed={active}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="h-10 min-w-0 justify-center whitespace-normal px-3 lg:ml-auto"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
          >
            <Command />
            Advanced
            <ChevronDown className={cn("transition-transform", advancedOpen && "rotate-180")} />
          </Button>
        </div>

        {advancedOpen ? (
          <motion.form
            className="flex min-w-0 flex-col gap-2 border-t border-primary/[0.12] pt-3 lg:flex-row lg:items-center"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md border border-primary/[0.16] bg-[#050505]/70 px-3 lg:min-h-10">
              <Command className="size-4 shrink-0 text-nexus-champagne" />
              <Input
                className="h-10 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Custom prompt"
                aria-label="NEXUS custom prompt input"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="h-11 min-w-0 whitespace-normal lg:h-10 lg:w-auto"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  Run Command
                  <ArrowUpRight />
                </>
              )}
            </Button>
          </motion.form>
        ) : null}
      </div>
    </motion.section>
  );
}
