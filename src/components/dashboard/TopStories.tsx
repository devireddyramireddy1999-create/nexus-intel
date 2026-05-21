import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { topStories } from "@/data/mockData";
import { formatPublishedTime } from "@/lib/utils";
import { getNewsData, type ApiMeta } from "@/services/backendApi";
import type { IntelligenceStory } from "@/types/intel";

const sentimentVariant = {
  bullish: "success",
  neutral: "secondary",
  caution: "warning",
  risk: "danger",
} as const;

export function TopStories() {
  const [stories, setStories] = useState<IntelligenceStory[]>(topStories);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getNewsData()
      .then((response) => {
        if (!active) return;
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-nexus-cyan">
              <Newspaper className="size-4" />
              Top Stories
            </div>
            <CardTitle>Signal-Weighted Headlines</CardTitle>
          </div>
          <Badge variant={meta?.fallback ? "warning" : "secondary"}>
            {loading ? "Loading" : meta?.fallback ? "Fallback" : "Live RSS"}
          </Badge>
        </div>
      </CardHeader>
      {meta?.error ? <p className="px-5 pb-3 text-xs text-nexus-ember">Backend unavailable. Showing local news fallback.</p> : null}
      <CardContent className="space-y-3">
        {stories.slice(0, 8).map((story) => (
          <article key={story.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="default">{story.section}</Badge>
              <Badge variant={sentimentVariant[story.sentiment]}>{story.sentiment}</Badge>
              <span className="text-xs text-muted-foreground">{story.confidence}% confidence</span>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {story.source ?? "NEXUS"} / {formatPublishedTime(story.publishedAt)}
            </p>
            <h3 className="text-base font-semibold leading-6 text-foreground">{story.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{story.summary}</p>
            <p className="mt-3 border-l border-nexus-cyan/40 pl-3 text-sm leading-6 text-foreground">{story.impact}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
