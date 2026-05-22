import { useEffect, useState } from "react";
import { BrainCircuit, Cpu, Network, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPublishedTime } from "@/lib/utils";
import { getCachedNewsData, getNewsData, type ApiMeta } from "@/services/backendApi";
import type { IntelligenceStory, TechSignal } from "@/types/intel";

const infrastructureStack = [
  { label: "GPU Clusters", value: 91, icon: Cpu },
  { label: "Private Retrieval", value: 84, icon: Network },
  { label: "AI Governance", value: 81, icon: ShieldCheck },
];

export function AITechPage() {
  const [initialState] = useState(() => getCachedAiTechState());
  const [signals, setSignals] = useState<TechSignal[]>(initialState.signals);
  const [stories, setStories] = useState<IntelligenceStory[]>(initialState.stories);
  const [meta, setMeta] = useState<ApiMeta | null>(initialState.meta);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getNewsData()
      .then((response) => {
        if (!active) return;
        setSignals(response.data.techSignals);
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
        eyebrow="AI & Tech"
        title="Machine Intelligence Signals"
        description="Compute demand, agent adoption, security governance, and second-order infrastructure beneficiaries."
        icon={BrainCircuit}
        badge={loading ? (meta?.stale ? "Last live snapshot — refreshing..." : "Loading live intelligence...") : meta?.fallback ? "Live feeds unavailable — fallback mode" : "Live RSS"}
      />
      {meta?.error ? <p className="mb-4 text-xs text-nexus-ember">News backend unavailable after retries. Showing fallback mode.</p> : null}
      {loading && !signals.length && !stories.length ? <p className="mb-4 text-sm text-muted-foreground">Warming live intelligence feeds...</p> : null}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Signal Velocity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {signals.map((signal) => (
              <article key={signal.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <Badge>{signal.label}</Badge>
                <h2 className="mt-3 text-base font-semibold leading-6 text-foreground">{signal.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Velocity</span>
                    <span className="text-foreground">{signal.velocity}</span>
                  </div>
                  <Progress value={signal.velocity} />
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Infrastructure Stack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {infrastructureStack.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-nexus-cyan" />
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                  <Progress value={item.value} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {stories
          .filter((story) => story.section === "AI & Tech")
          .map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <CardTitle>{story.title}</CardTitle>
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

function getCachedAiTechState() {
  const cached = getCachedNewsData();

  return {
    meta: cached?.meta ?? null,
    signals: cached?.data.techSignals ?? [],
    stories: cached?.data.stories ?? [],
  };
}
