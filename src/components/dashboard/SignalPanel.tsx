import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { priorities } from "@/data/mockData";
import { getCachedCryptoData, getCachedNewsData, getCryptoData, getNewsData, type ApiMeta } from "@/services/backendApi";
import type { CryptoSignal, TechSignal, WatchItem } from "@/types/intel";

type SignalPanelProps = {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  variant: "geo" | "tech" | "crypto" | "priority";
};

export function SignalPanel({ title, eyebrow, icon: Icon, variant }: SignalPanelProps) {
  const [geoItems, setGeoItems] = useState<WatchItem[]>(() => getCachedNewsData()?.data.geopoliticalWatch ?? []);
  const [techItems, setTechItems] = useState<TechSignal[]>(() => getCachedNewsData()?.data.techSignals ?? []);
  const [cryptoItems, setCryptoItems] = useState<CryptoSignal[]>(() => getCachedCryptoData()?.data.radar ?? []);
  const [meta, setMeta] = useState<ApiMeta | null>(() =>
    variant === "crypto" ? getCachedCryptoData()?.meta ?? null : getCachedNewsData()?.meta ?? null,
  );
  const [loading, setLoading] = useState(variant !== "priority");

  useEffect(() => {
    let active = true;

    if (variant === "priority") {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    if (variant === "crypto") {
      getCryptoData()
        .then((response) => {
          if (!active) return;
          setMeta(response.meta);
          setCryptoItems(response.data.radar);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      getNewsData()
        .then((response) => {
          if (!active) return;
          setMeta(response.meta);
          setGeoItems(response.data.geopoliticalWatch);
          setTechItems(response.data.techSignals);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [variant]);

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
              <Icon className="size-4 shrink-0" />
              {eyebrow}
            </div>
            <CardTitle className="break-words">{title}</CardTitle>
          </div>
          <Badge variant={meta?.fallback ? "warning" : "secondary"}>
            {loading ? (meta?.stale ? "Last live snapshot — refreshing..." : "Loading live intelligence...") : meta?.fallback ? "Live feeds unavailable — fallback mode" : variant}
          </Badge>
        </div>
      </CardHeader>
      {meta?.error ? <p className="px-5 pb-3 text-xs text-nexus-ember">Live feed unavailable after retries. Showing fallback mode.</p> : null}
      <CardContent>{renderPanel(variant, { cryptoItems, geoItems, loading, techItems })}</CardContent>
    </Card>
  );
}

function renderPanel(
  variant: SignalPanelProps["variant"],
  data: { cryptoItems: CryptoSignal[]; geoItems: WatchItem[]; loading: boolean; techItems: TechSignal[] },
) {
  if (data.loading) {
    const hasCachedItems = data.cryptoItems.length || data.geoItems.length || data.techItems.length;
    if (!hasCachedItems) return <p className="text-sm text-muted-foreground">Warming live intelligence feeds...</p>;
  }

  if (variant === "geo") {
    return (
      <div className="space-y-3">
        {data.geoItems.slice(0, 3).map((item) => (
          <div key={item.region} className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-3">
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
        {data.techItems.map((signal) => (
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
        {data.cryptoItems.map((item) => (
          <div key={item.asset} className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-3">
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
        <div key={item.title} className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-3">
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
