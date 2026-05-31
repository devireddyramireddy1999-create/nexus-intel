import { useState } from "react";
import { Bell, Database, LockKeyhole, Moon, RotateCcw, Save, Settings, SlidersHorizontal, UserRound, Wifi } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { clearAccessToken } from "@/services/accessService";
import {
  clearPersonalContext,
  emptyPersonalContext,
  getPersonalContext,
  hasPersonalContext,
  savePersonalContext,
} from "@/services/personalContextService";
import type { PersonalContext } from "@/types/intel";

const settings = [
  { label: "Dark command mode", value: "Enabled", icon: Moon },
  { label: "Mock data engine", value: "Local", icon: Database },
  { label: "Briefing alerts", value: "Morning", icon: Bell },
  { label: "PWA shell", value: "Ready", icon: Wifi },
];

export function SettingsPage() {
  const [personalContext, setPersonalContext] = useState<PersonalContext>(() => getPersonalContext());
  const [saved, setSaved] = useState(false);
  const contextActive = hasPersonalContext(personalContext);

  const lockApp = () => {
    clearAccessToken();
  };

  const updatePersonalContext = (field: keyof PersonalContext, value: string) => {
    setSaved(false);
    setPersonalContext((context) => ({
      ...context,
      [field]: value,
    }));
  };

  const handleSavePersonalContext = () => {
    savePersonalContext(personalContext);
    setSaved(true);
  };

  const handleClearPersonalContext = () => {
    clearPersonalContext();
    setPersonalContext(emptyPersonalContext);
    setSaved(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="NEXUS Control Surface"
        description="Briefing profile, local data source status, appearance, and future integration switches."
        icon={Settings}
        badge="Local first"
      />
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>System State</CardTitle>
              <SlidersHorizontal className="size-5 text-nexus-champagne" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-nexus-champagne" />
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                  </div>
                  <Badge variant="secondary">{item.value}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Briefing Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {["Markets-first", "Geopolitics-aware", "Priority-linked"].map((profile) => (
                <button
                  key={profile}
                  className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-4 text-left transition hover:border-nexus-champagne/40 hover:bg-nexus-champagne/5"
                >
                  <p className="text-sm font-semibold text-foreground">{profile}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Active in local mock configuration.</p>
                </button>
              ))}
            </div>
            <Separator className="my-5" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">Access gate</p>
                <p className="mt-1 text-sm text-muted-foreground">Lock this browser and require the app access code again.</p>
              </div>
              <Button variant="secondary" onClick={lockApp}>
                <LockKeyhole />
                Lock NEXUS
              </Button>
            </div>
            <Separator className="my-5" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">External data connectors</p>
                <p className="mt-1 text-sm text-muted-foreground">Reserved for live feeds after mock validation.</p>
              </div>
              <Button variant="outline">Configure</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
                <UserRound className="size-4" />
                Personal Context V1
              </div>
              <CardTitle>Ram Context Layer</CardTitle>
            </div>
            <Badge variant={contextActive ? "success" : "secondary"}>{contextActive ? "Active" : "Not set"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <ContextField
              label="Main life goal"
              value={personalContext.mainLifeGoal}
              onChange={(value) => updatePersonalContext("mainLifeGoal", value)}
              placeholder="Build NEXUS into a premium decision intelligence app."
            />
            <ContextField
              label="Current primary project"
              value={personalContext.currentPrimaryProject}
              onChange={(value) => updatePersonalContext("currentPrimaryProject", value)}
              placeholder="Improve NEXUS intelligence quality."
            />
            <ContextField
              label="Current work/school priority"
              value={personalContext.workSchoolPriority}
              onChange={(value) => updatePersonalContext("workSchoolPriority", value)}
              placeholder="Stay focused and avoid wasting time."
            />
            <ContextField
              label="Fitness/health priority"
              value={personalContext.fitnessHealthPriority}
              onChange={(value) => updatePersonalContext("fitnessHealthPriority", value)}
              placeholder="Stay consistent with gym and food."
            />
            <ContextField
              label="Financial priority"
              value={personalContext.financialPriority}
              onChange={(value) => updatePersonalContext("financialPriority", value)}
              placeholder="Avoid emotional decisions."
            />
            <ContextField
              label="Current schedule note"
              value={personalContext.currentScheduleNote}
              onChange={(value) => updatePersonalContext("currentScheduleNote", value)}
              placeholder="Limited time because of work and school."
            />
            <ContextArea
              label="Things to avoid"
              value={personalContext.thingsToAvoid}
              onChange={(value) => updatePersonalContext("thingsToAvoid", value)}
              placeholder="Overchecking markets, random feature changes, distraction."
            />
            <ContextArea
              label="Personal watchlist"
              value={personalContext.personalWatchlist}
              onChange={(value) => updatePersonalContext("personalWatchlist", value)}
              placeholder="BTC, QQQ, oil, gold, AI news, geopolitical risk."
            />
          </div>

          <Separator className="my-5" />
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {saved ? "Personal context saved for future dashboard reads and generated briefs." : "Saved on this device and used only when generating a brief."}
            </p>
            <div className="flex min-w-0 flex-wrap gap-2">
              <Button type="button" onClick={handleSavePersonalContext}>
                <Save />
                Save Context
              </Button>
              <Button type="button" variant="outline" onClick={handleClearPersonalContext}>
                <RotateCcw />
                Clear Context
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ContextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function ContextArea({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className={cn(
          "min-h-24 w-full resize-y rounded-md border border-primary/[0.16] bg-[#050505]/70 px-3 py-2 text-base leading-6 text-foreground shadow-inner transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
        )}
      />
    </label>
  );
}
