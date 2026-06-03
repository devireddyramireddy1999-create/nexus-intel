import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Moon, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatLocalTime } from "@/lib/utils";

type DebriefStatus = "Followed today's action" | "Partially followed" | "Missed / distracted";

type SavedDebrief = {
  carryForward: string;
  distractedBy: string;
  savedAt: string;
  status: DebriefStatus;
};

const debriefStoragePrefix = "nexus-intel-end-of-day-debrief";
const debriefUpdatedEvent = "nexus-intel-end-of-day-debrief-updated";
const statusOptions: DebriefStatus[] = ["Followed today's action", "Partially followed", "Missed / distracted"];

export function CarryForwardCard() {
  const [carryForward, setCarryForward] = useState(() => readLatestCarryForward());

  useEffect(() => {
    const handleDebriefUpdate = () => setCarryForward(readLatestCarryForward());

    window.addEventListener(debriefUpdatedEvent, handleDebriefUpdate);
    window.addEventListener("storage", handleDebriefUpdate);
    return () => {
      window.removeEventListener(debriefUpdatedEvent, handleDebriefUpdate);
      window.removeEventListener("storage", handleDebriefUpdate);
    };
  }, []);

  if (!carryForward) return null;

  return (
    <Card className="border-primary/[0.16] bg-[#080808]/80">
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
              <ArrowRight className="size-4" />
              Carry Forward
            </div>
            <p className="break-words text-sm font-semibold leading-6 text-foreground sm:text-base">{carryForward.text}</p>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0">
            From last debrief
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function EndOfDayDebriefCard() {
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const storageKey = `${debriefStoragePrefix}:${todayKey}`;
  const [status, setStatus] = useState<DebriefStatus>("Partially followed");
  const [distractedBy, setDistractedBy] = useState("");
  const [carryForward, setCarryForward] = useState("");
  const [savedDebrief, setSavedDebrief] = useState<SavedDebrief | null>(null);

  useEffect(() => {
    const saved = readDebrief(storageKey);
    if (!saved) return;

    setStatus(saved.status);
    setDistractedBy(saved.distractedBy);
    setCarryForward(saved.carryForward);
    setSavedDebrief(saved);
  }, [storageKey]);

  const handleSave = () => {
    const nextDebrief: SavedDebrief = {
      carryForward: carryForward.trim(),
      distractedBy: distractedBy.trim(),
      savedAt: new Date().toISOString(),
      status,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(nextDebrief));
    setSavedDebrief(nextDebrief);
    notifyDebriefUpdate();
  };

  const handleClear = () => {
    window.localStorage.removeItem(storageKey);
    setStatus("Partially followed");
    setDistractedBy("");
    setCarryForward("");
    setSavedDebrief(null);
    notifyDebriefUpdate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
              <Moon className="size-4" />
              Daily Loop
            </div>
            <CardTitle>End-of-Day Debrief</CardTitle>
            <CardDescription className="mt-1">Close the loop before tomorrow's brief.</CardDescription>
          </div>
          <Badge variant={savedDebrief ? "success" : "secondary"}>{savedDebrief ? "Saved today" : "Open loop"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0 space-y-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              {statusOptions.map((option) => {
                const active = status === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "min-w-0 rounded-md border border-primary/[0.14] bg-[#0a0a0a]/75 px-3 py-2 text-left text-sm leading-5 text-muted-foreground transition",
                      "hover:border-primary/[0.28] hover:text-foreground",
                      active && "border-primary/[0.32] bg-primary/[0.08] text-nexus-champagne",
                    )}
                    onClick={() => setStatus(option)}
                    aria-pressed={active}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-muted-foreground">What distracted you?</span>
                <Input
                  value={distractedBy}
                  onChange={(event) => setDistractedBy(event.target.value)}
                  maxLength={160}
                  placeholder="Noise, headline checking, context switching"
                />
              </label>
              <label className="min-w-0">
                <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-muted-foreground">What should carry into tomorrow?</span>
                <Input
                  value={carryForward}
                  onChange={(event) => setCarryForward(event.target.value)}
                  maxLength={160}
                  placeholder="One priority, one rule, one watch item"
                />
              </label>
            </div>

            <div className="flex min-w-0 flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleSave}>
                <Save />
                Save Debrief
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                <RotateCcw />
                Clear
              </Button>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-3">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <CheckCircle2 className="size-4 text-nexus-champagne" />
              Saved Debrief
            </div>
            {savedDebrief ? (
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">{savedDebrief.status}</span>
                  <span className="text-muted-foreground"> at {formatLocalTime(savedDebrief.savedAt)}</span>
                </p>
                <p className="break-words">Distracted by: {savedDebrief.distractedBy || "None logged."}</p>
                <p className="break-words">Carry forward: {savedDebrief.carryForward || "No carry-forward note yet."}</p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Save tonight's reflection to make tomorrow's command brief sharper.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function readDebrief(key: string): SavedDebrief | null {
  if (typeof window === "undefined") return null;

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

function readLatestCarryForward() {
  if (typeof window === "undefined") return null;

  const entries = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(`${debriefStoragePrefix}:`)))
    .map((key) => {
      const debrief = readDebrief(key);
      const dateKey = key.replace(`${debriefStoragePrefix}:`, "");
      return {
        dateKey,
        debrief,
      };
    })
    .filter((entry): entry is { dateKey: string; debrief: SavedDebrief } => Boolean(entry.debrief?.carryForward.trim()))
    .sort((a, b) => {
      const dateCompare = b.dateKey.localeCompare(a.dateKey);
      if (dateCompare !== 0) return dateCompare;
      return Date.parse(b.debrief.savedAt) - Date.parse(a.debrief.savedAt);
    });

  const latest = entries[0];
  if (!latest) return null;

  return {
    dateKey: latest.dateKey,
    text: latest.debrief.carryForward.trim(),
  };
}

function isDebriefStatus(value: unknown): value is DebriefStatus {
  return typeof value === "string" && statusOptions.includes(value as DebriefStatus);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function notifyDebriefUpdate() {
  window.dispatchEvent(new CustomEvent(debriefUpdatedEvent));
}
