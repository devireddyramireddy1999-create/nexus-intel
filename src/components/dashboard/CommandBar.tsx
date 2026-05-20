import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Command, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BriefingMode } from "@/types/intel";

type CommandBarProps = {
  isLoading?: boolean;
  mode: BriefingMode;
  onModeChange: (mode: BriefingMode) => void;
  onSubmit: (command: string) => void | Promise<void>;
};

const modes: { key: BriefingMode; label: string }[] = [
  { key: "quick", label: "Quick Brief" },
  { key: "standard", label: "Standard Brief" },
  { key: "deep", label: "Deep Dive" },
];

export function CommandBar({ isLoading = false, mode, onModeChange, onSubmit }: CommandBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(value);
    setValue("");
  };

  return (
    <motion.section
      className="glass-card panel-line mb-5 rounded-lg p-3 sm:p-4"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <form className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center" onSubmit={handleSubmit}>
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md border border-nexus-cyan/25 bg-black/30 px-3">
          <Command className="size-4 shrink-0 text-nexus-cyan" />
          <Input
            className="h-10 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Good morning"
            aria-label="NEXUS command input"
            disabled={isLoading}
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:flex">
          {modes.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={mode === item.key ? "default" : "outline"}
              className="min-w-0 whitespace-normal px-2 text-center text-xs leading-tight sm:px-3 sm:text-sm"
              onClick={() => onModeChange(item.key)}
              disabled={isLoading}
            >
              <Sparkles className="hidden sm:block" />
              {item.label}
            </Button>
          ))}
        </div>
        <Button type="submit" className="min-w-0 whitespace-normal lg:w-auto" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Generating
            </>
          ) : (
            <>
              Generate
              <ArrowUpRight />
            </>
          )}
        </Button>
      </form>
    </motion.section>
  );
}
