import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Clock3, Copy, FileText, Loader2, RadioTower, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalTime } from "@/lib/utils";
import type { GeneratedBriefing } from "@/types/intel";

type BriefingOutputProps = {
  briefing: GeneratedBriefing | null;
  copied?: boolean;
  error?: string;
  isLoading?: boolean;
  isSavedBriefing?: boolean;
  onClear?: () => void;
  onCopy?: () => void;
  onRefresh?: () => void;
};

export function BriefingOutput({
  briefing,
  copied = false,
  error,
  isLoading = false,
  isSavedBriefing = false,
  onClear,
  onCopy,
  onRefresh,
}: BriefingOutputProps) {
  const generatedTime = briefing ? formatLocalTime(briefing.generatedAt) : "";

  return (
    <Card className="min-h-[22rem]">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-nexus-champagne">
            <RadioTower className="size-4" />
            Briefing Stream
          </div>
          <CardTitle className="break-words">Structured Intelligence Briefing</CardTitle>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {briefing ? (
            <Badge className="gap-1">
              <Clock3 className="size-3" />
              {isSavedBriefing ? "Last generated brief" : "Generated"} {generatedTime}
            </Badge>
          ) : (
            <Badge variant={error ? "danger" : "secondary"}>{error ? "Error" : "Standby"}</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 whitespace-normal"
            onClick={onRefresh}
            disabled={!briefing || isLoading}
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
            Refresh Brief
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-w-0 whitespace-normal"
            onClick={onCopy}
            disabled={!briefing || isLoading}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy Brief"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 whitespace-normal"
            onClick={onClear}
            disabled={!briefing || isLoading}
          >
            Clear Brief
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {error ? (
          <div className="mb-4 flex gap-3 rounded-lg border border-nexus-danger/35 bg-nexus-danger/10 p-4 text-sm text-nexus-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Briefing error</p>
              <p className="mt-1 break-words leading-6">{error}</p>
            </div>
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          {isLoading && !briefing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[15rem] flex-col items-center justify-center rounded-lg border border-primary/[0.18] bg-[#0a0a0a]/80 p-6 text-center"
            >
              <Loader2 className="mb-4 size-10 animate-spin text-nexus-champagne" />
              <p className="text-lg font-semibold text-foreground">Generating daily brief</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                NEXUS is synthesizing live news, markets, crypto, AI/tech, and personal priorities.
              </p>
            </motion.div>
          ) : briefing ? (
            <motion.div
              key={briefing.generatedAt + briefing.mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="min-w-0 space-y-5"
            >
              <div className="rounded-lg border border-primary/[0.18] bg-[#0e0e0e]/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">{briefing.mode} mode</p>
                  <span className="text-xs text-muted-foreground">
                    {isSavedBriefing ? "Last briefing" : "Generated"} {generatedTime}
                    {briefing.dataQuality ? ` / Data quality: ${briefing.dataQuality}` : ""}
                  </span>
                </div>
                <p className="mt-2 break-words text-base font-semibold leading-7 text-foreground sm:text-lg">{briefing.headline}</p>
              </div>
              {briefing.sections.map((section) => (
                <section key={section.title} className="min-w-0">
                  <h3 className="mb-2 break-words text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:tracking-[0.2em]">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="min-w-0 break-words rounded-md border border-primary/[0.14] bg-[#0a0a0a]/75 px-3 py-2 text-sm leading-6 text-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[15rem] flex-col items-center justify-center rounded-lg border border-dashed border-primary/20 bg-primary/[0.025] p-6 text-center"
            >
              <FileText className="mb-4 size-10 text-nexus-champagne" />
              <p className="text-lg font-semibold text-foreground">No briefing generated yet</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Use Generate Morning Brief to synthesize the current intelligence stack, or type a custom command.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
