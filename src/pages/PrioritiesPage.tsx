import { CalendarClock, CheckCircle2, Target } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { priorities } from "@/data/mockData";

export function PrioritiesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Personal Priorities"
        title="Sample Execution Stack"
        description="Sample local priority cards for layout reference. Personal Read uses saved context for the daily command."
        icon={Target}
        badge="Sample"
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {priorities.map((priority) => (
          <Card key={priority.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{priority.title}</CardTitle>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="size-4" />
                    {priority.due}
                  </div>
                </div>
                <Badge>{priority.energy}%</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{priority.focus}</p>
              <div className="mt-4 rounded-lg border border-primary/[0.16] bg-[#0a0a0a]/70 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="size-4 text-nexus-good" />
                  Next Action
                </div>
                <p className="text-sm leading-6 text-foreground">{priority.nextAction}</p>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Energy</span>
                  <span className="text-foreground">{priority.energy}</span>
                </div>
                <Progress value={priority.energy} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Sample Operating Rhythm</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {["Deep work", "Market check", "Memo draft", "Evening review"].map((item, index) => (
            <div key={item} className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Block {index + 1}</p>
              <p className="mt-2 text-base font-semibold text-foreground">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
