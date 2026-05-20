import { Crosshair, Globe2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { geopoliticalWatch, riskSignals, topStories } from "@/data/mockData";

export function GeopoliticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Geopolitics"
        title="Global Watch Floor"
        description="Regional pressure, shipping exposure, supply-chain sensitivity, and defense technology demand in one briefing surface."
        icon={Globe2}
        badge="4 regions"
      />
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
            {geopoliticalWatch.map((item) => (
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
            {riskSignals.map((signal) => (
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
        {topStories
          .filter((story) => story.section === "World" || story.section === "Geopolitics")
          .map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{story.title}</CardTitle>
                  <Badge>{story.confidence}%</Badge>
                </div>
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
