import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { riskSignals } from "@/data/mockData";
import { cn } from "@/lib/utils";

export function RiskMeter() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-nexus-cyan">Risk Meter</p>
            <CardTitle className="mt-1">Global Risk Stack</CardTitle>
          </div>
          <ShieldAlert className="size-5 text-nexus-ember" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {riskSignals.map((signal) => (
          <div key={signal.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className={cn("size-4", signal.value > 65 ? "text-nexus-ember" : "text-nexus-good")} />
                <p className="text-sm font-medium text-foreground">{signal.label}</p>
              </div>
              <p className="text-sm text-muted-foreground">{signal.value}/100</p>
            </div>
            <Progress value={signal.value} />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
