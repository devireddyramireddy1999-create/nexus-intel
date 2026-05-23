import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getCachedNewsData, getNewsData, type ApiMeta } from "@/services/backendApi";
import type { RiskSignal } from "@/types/intel";

export function RiskMeter() {
  const [signals, setSignals] = useState<RiskSignal[]>(() => getCachedNewsData()?.data.riskSignals ?? []);
  const [meta, setMeta] = useState<ApiMeta | null>(() => getCachedNewsData()?.meta ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getNewsData()
      .then((response) => {
        if (!active) return;
        setSignals(response.data.riskSignals);
        setMeta(response.meta);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">Risk Meter</p>
            <CardTitle className="mt-1">Global Risk Stack</CardTitle>
          </div>
          <ShieldAlert className="size-5 shrink-0 text-nexus-ember" />
        </div>
      </CardHeader>
      {meta?.error ? <p className="px-5 pb-3 text-xs text-nexus-ember">Risk feed unavailable after retries. Showing fallback mode.</p> : null}
      <CardContent className="space-y-4">
        {loading && !signals.length ? <p className="text-sm text-muted-foreground">Warming live intelligence feeds...</p> : null}
        {loading && signals.length ? <p className="text-sm text-muted-foreground">Last live snapshot — refreshing...</p> : null}
        {signals.map((signal) => (
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
