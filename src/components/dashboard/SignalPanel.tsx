import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cryptoRadar, geopoliticalWatch, priorities, techSignals } from "@/data/mockData";

type SignalPanelProps = {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  variant: "geo" | "tech" | "crypto" | "priority";
};

export function SignalPanel({ title, eyebrow, icon: Icon, variant }: SignalPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-cyan sm:tracking-[0.26em]">
              <Icon className="size-4 shrink-0" />
              {eyebrow}
            </div>
            <CardTitle className="break-words">{title}</CardTitle>
          </div>
          <Badge variant="secondary">{variant}</Badge>
        </div>
      </CardHeader>
      <CardContent>{renderPanel(variant)}</CardContent>
    </Card>
  );
}

function renderPanel(variant: SignalPanelProps["variant"]) {
  if (variant === "geo") {
    return (
      <div className="space-y-3">
        {geopoliticalWatch.slice(0, 3).map((item) => (
          <div key={item.region} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="break-words text-sm font-semibold text-foreground">{item.region}</p>
              <Badge variant={item.severity === "High" ? "warning" : "secondary"}>{item.severity}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.title}</p>
            <p className="mt-2 text-xs leading-5 text-foreground">{item.signal}</p>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "tech") {
    return (
      <div className="space-y-4">
        {techSignals.map((signal) => (
          <div key={signal.label}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{signal.label}</p>
              <span className="text-xs text-muted-foreground">{signal.velocity}</span>
            </div>
            <Progress value={signal.velocity} />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.detail}</p>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "crypto") {
    return (
      <div className="space-y-3">
        {cryptoRadar.map((item) => (
          <div key={item.asset} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="break-words text-sm font-semibold text-foreground">{item.asset}</p>
              <Badge>{item.score}</Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{item.thesis}</p>
            <p className="mt-2 text-xs leading-5 text-foreground">{item.flow}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {priorities.map((item) => (
        <div key={item.title} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-words text-sm font-semibold text-foreground">{item.title}</p>
            <Badge variant="secondary">{item.due}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.focus}</p>
          <p className="mt-2 text-xs leading-5 text-foreground">{item.nextAction}</p>
        </div>
      ))}
    </div>
  );
}
