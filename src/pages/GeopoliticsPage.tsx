import { useEffect, useState } from "react";
import { Crosshair, Globe2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPublishedTime } from "@/lib/utils";
import { getCachedNewsData, getNewsData, type ApiMeta } from "@/services/backendApi";
import type { IntelligenceStory, RiskSignal, WatchItem } from "@/types/intel";

export function GeopoliticsPage() {
  const [initialState] = useState(() => getCachedNewsState());
  const [watch, setWatch] = useState<WatchItem[]>(initialState.watch);
  const [risks, setRisks] = useState<RiskSignal[]>(initialState.risks);
  const [stories, setStories] = useState<IntelligenceStory[]>(initialState.stories);
  const [meta, setMeta] = useState<ApiMeta | null>(initialState.meta);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getNewsData()
      .then((response) => {
        if (!active) return;
        setWatch(response.data.geopoliticalWatch);
        setRisks(response.data.riskSignals);
        setStories(response.data.stories);
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
    <>
      <PageHeader
        eyebrow="Geopolitics"
        title="Global Watch Floor"
        description="Regional pressure, shipping exposure, supply-chain sensitivity, and defense technology demand in one briefing surface."
        icon={Globe2}
        badge={loading ? (meta?.stale ? "Last live snapshot — refreshing..." : "Loading live intelligence...") : meta?.fallback ? "Live feeds unavailable — fallback mode" : "Live RSS"}
      />
      {meta?.error ? <p className="mb-4 text-xs text-nexus-ember">News backend unavailable after retries. Showing fallback mode.</p> : null}
      {loading && !watch.length && !stories.length ? <p className="mb-4 text-sm text-muted-foreground">Warming live intelligence feeds...</p> : null}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-nexus-cyan">Watchlist</p>
                <CardTitle className="mt-1">Regional Pressure Points</CardTitle>
              </div>
              <Crosshair className="size-5 text-nexus-cyan" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {watch.map((item) => (
              <article key={item.region} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">{item.region}</h2>
                  <Badge variant={item.severity === "High" ? "warning" : "secondary"}>{item.severity}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.signal}</p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Risk Channels</CardTitle>
              <ShieldAlert className="size-5 text-nexus-ember" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {risks.map((signal) => (
              <div key={signal.label}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{signal.label}</p>
                  <Badge variant={signal.value > 65 ? "warning" : "secondary"}>{signal.posture}</Badge>
                </div>
                <Progress value={signal.value} />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {stories
          .filter((story) => story.section === "World" || story.section === "Geopolitics")
          .map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{story.title}</CardTitle>
                  <Badge>{story.confidence}%</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {story.source ?? "NEXUS"} / {formatPublishedTime(story.publishedAt)}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{story.summary}</p>
                <p className="mt-3 rounded-md border border-nexus-cyan/20 bg-nexus-cyan/5 p-3 text-sm leading-6 text-foreground">
                  {story.impact}
                </p>
              </CardContent>
            </Card>
          ))}
      </div>
    </>
  );
}

function getCachedNewsState() {
  const cached = getCachedNewsData();

  return {
    meta: cached?.meta ?? null,
    risks: cached?.data.riskSignals ?? [],
    stories: cached?.data.stories ?? [],
    watch: cached?.data.geopoliticalWatch ?? [],
  };
}
