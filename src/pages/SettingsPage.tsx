import { Bell, Database, LockKeyhole, Moon, Settings, SlidersHorizontal, Wifi } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { clearAccessToken } from "@/services/accessService";

const settings = [
  { label: "Dark command mode", value: "Enabled", icon: Moon },
  { label: "Mock data engine", value: "Local", icon: Database },
  { label: "Briefing alerts", value: "Morning", icon: Bell },
  { label: "PWA shell", value: "Ready", icon: Wifi },
];

export function SettingsPage() {
  const lockApp = () => {
    clearAccessToken();
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
              <SlidersHorizontal className="size-5 text-nexus-cyan" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-nexus-cyan" />
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
                  className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-nexus-cyan/40 hover:bg-nexus-cyan/5"
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
    </>
  );
}
