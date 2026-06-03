import type { ElementType } from "react";
import { BarChart3, CalendarDays, CheckCircle2, CircleDashed, ClipboardList, Forward, Target, XCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DebriefStatus = "Followed today's action" | "Partially followed" | "Missed / distracted";

type SavedDebrief = {
  carryForward: string;
  dateKey: string;
  distractedBy: string;
  savedAt: string;
  status: DebriefStatus;
};

const debriefStoragePrefix = "nexus-intel-end-of-day-debrief";
const statusOptions: DebriefStatus[] = ["Followed today's action", "Partially followed", "Missed / distracted"];
const weakDistractionWords = new Set([
  "and",
  "checking",
  "distraction",
  "distractions",
  "from",
  "headline",
  "headlines",
  "more",
  "noise",
  "random",
  "switching",
  "too",
]);

export function ReportsPage() {
  const debriefs = readDebriefHistory();
  const weeklyDebriefs = debriefs.filter((debrief) => isCurrentWeek(debrief.dateKey));
  const report = buildWeeklyReport(weeklyDebriefs);
  const hasEnoughData = weeklyDebriefs.length >= 2;

  return (
    <>
      <PageHeader
        eyebrow="Weekly Review"
        title="Weekly Intelligence Report"
        description="A local review of your end-of-day debriefs, follow-through, distractions, and carry-forward priorities."
        icon={BarChart3}
        badge="Local report"
      />

      {!hasEnoughData ? (
        <Card>
          <CardContent className="flex min-h-[18rem] flex-col items-center justify-center p-6 text-center">
            <ClipboardList className="mb-4 size-10 text-nexus-champagne" />
            <p className="text-lg font-semibold text-foreground">Save a few end-of-day debriefs to unlock your weekly intelligence report.</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              NEXUS needs at least two saved reflections this week before it can summarize patterns without guessing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-4">
            <MetricCard icon={CalendarDays} label="Debriefs saved" value={String(weeklyDebriefs.length)} />
            <MetricCard icon={CheckCircle2} label="Followed" value={String(report.statusCounts.followed)} />
            <MetricCard icon={CircleDashed} label="Partial" value={String(report.statusCounts.partial)} />
            <MetricCard icon={XCircle} label="Missed" value={String(report.statusCounts.missed)} />
          </div>

          <Card>
            <CardHeader>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
                    <BarChart3 className="size-4" />
                    Weekly Pattern
                  </div>
                  <CardTitle>Decision Ritual Review</CardTitle>
                </div>
                <Badge>Debrief history</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 lg:grid-cols-3">
              <ReportBlock title="Pattern Summary" value={report.patternSummary} />
              <ReportBlock title="Common Distractions" value={report.distractionSummary} />
              <ReportBlock title="Suggested Focus" value={report.suggestedFocus} strong />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
                <Forward className="size-4" />
                Carry Forward
              </div>
              <CardTitle>Latest Carry-Forward Item</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-words rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-4 text-sm font-semibold leading-6 text-foreground">
                {report.latestCarryForward || "No carry-forward item saved this week."}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="break-words text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <Icon className="size-4 shrink-0 text-nexus-champagne" />
        </div>
        <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ReportBlock({ title, value, strong = false }: { title: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-4">
      <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Target className="size-4 text-nexus-champagne" />
        {title}
      </div>
      <p className={strong ? "break-words text-sm font-semibold leading-6 text-foreground" : "break-words text-sm leading-6 text-muted-foreground"}>
        {value}
      </p>
    </div>
  );
}

function buildWeeklyReport(debriefs: SavedDebrief[]) {
  const statusCounts = {
    followed: debriefs.filter((debrief) => debrief.status === "Followed today's action").length,
    missed: debriefs.filter((debrief) => debrief.status === "Missed / distracted").length,
    partial: debriefs.filter((debrief) => debrief.status === "Partially followed").length,
  };
  const distractionTerms = getCommonDistractions(debriefs);
  const latestCarryForward = debriefs.find((debrief) => debrief.carryForward.trim())?.carryForward.trim() ?? "";
  const successCount = statusCounts.followed + statusCounts.partial;
  const distractionSummary = distractionTerms.length ? distractionTerms.join(", ") : "No repeated distraction pattern logged yet.";

  return {
    distractionSummary,
    latestCarryForward,
    patternSummary: `You followed through on ${successCount} of ${debriefs.length} saved debriefs. Distraction pattern: ${distractionSummary}.`,
    statusCounts,
    suggestedFocus: buildSuggestedFocus(statusCounts, distractionTerms, latestCarryForward),
  };
}

function buildSuggestedFocus(statusCounts: { followed: number; missed: number; partial: number }, distractions: string[], latestCarryForward: string) {
  if (statusCounts.missed > statusCounts.followed) {
    return distractions.length
      ? `Protect one focused build block before ${distractions[0]} can take over.`
      : "Protect one focused build block before checking headlines.";
  }

  if (latestCarryForward) {
    return `Start next week with the carry-forward item: ${latestCarryForward}.`;
  }

  return "Keep one daily debrief and one focused execution block as the baseline.";
}

function getCommonDistractions(debriefs: SavedDebrief[]) {
  const counts = new Map<string, number>();

  for (const debrief of debriefs) {
    for (const term of splitDistractionTerms(debrief.distractedBy)) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([term]) => term);
}

function splitDistractionTerms(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9,\s/;-]/g, " ")
    .split(/[,;/\n-]+|\band\b/)
    .map((term) => term.replace(/\s+/g, " ").trim())
    .filter((term) => term.length > 2 && !weakDistractionWords.has(term));
}

function readDebriefHistory() {
  if (typeof window === "undefined") return [];

  return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(`${debriefStoragePrefix}:`)))
    .map((key) => {
      const debrief = readDebrief(key);
      const dateKey = key.replace(`${debriefStoragePrefix}:`, "");
      return debrief ? { ...debrief, dateKey } : null;
    })
    .filter((debrief): debrief is SavedDebrief => Boolean(debrief))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

function readDebrief(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedDebrief>;
    if (!isDebriefStatus(parsed.status)) return null;

    return {
      carryForward: typeof parsed.carryForward === "string" ? parsed.carryForward : "",
      distractedBy: typeof parsed.distractedBy === "string" ? parsed.distractedBy : "",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
      status: parsed.status,
    };
  } catch {
    return null;
  }
}

function isDebriefStatus(value: unknown): value is DebriefStatus {
  return typeof value === "string" && statusOptions.includes(value as DebriefStatus);
}

function isCurrentWeek(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return false;

  const start = getStartOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return date >= start && date < end;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getStartOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}
