import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { BrainCircuit, EyeOff, Radar, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCachedCryptoData,
  getCachedMarketsData,
  getCachedNewsData,
  getCryptoData,
  getMarketsData,
  getNewsData,
} from "@/services/backendApi";
import { buildNexusJudgment } from "@/services/judgmentService";
import type { ChangeInsight, IntelligenceStory, MarketAsset, NexusJudgment, RiskSignal } from "@/types/intel";

type NexusJudgmentCardProps = {
  changeInsights?: ChangeInsight[];
};

type JudgmentInputs = {
  cryptoAssets: MarketAsset[];
  marketAssets: MarketAsset[];
  riskSignals: RiskSignal[];
  stories: IntelligenceStory[];
};

export function NexusJudgmentCard({ changeInsights = [] }: NexusJudgmentCardProps) {
  const [inputs, setInputs] = useState<JudgmentInputs>(() => getCachedJudgmentInputs());
  const [loading, setLoading] = useState(true);
  const judgment = useMemo(
    () => buildNexusJudgment({ ...inputs, changeInsights }),
    [changeInsights, inputs],
  );

  useEffect(() => {
    let active = true;

    Promise.all([getMarketsData(), getCryptoData(), getNewsData()])
      .then(([marketResponse, cryptoResponse, newsResponse]) => {
        if (!active) return;

        setInputs({
          cryptoAssets: cryptoResponse.data.assets,
          marketAssets: marketResponse.data.assets,
          riskSignals: newsResponse.data.riskSignals,
          stories: newsResponse.data.stories,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="relative overflow-hidden border-primary/[0.22] bg-[#080808]/90">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-nexus-champagne/80 to-transparent" />
      <CardHeader className="pb-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
              <BrainCircuit className="size-4" />
              NEXUS Judgment
            </div>
            <CardTitle className="text-lg">Decision Intelligence V1</CardTitle>
          </div>
          <Badge variant={loading ? "secondary" : getPostureBadgeVariant(judgment)}>
            {loading ? "Reading signals" : judgment.riskPosture}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Risk Posture</p>
            <div className="mt-3 flex min-w-0 flex-wrap items-end gap-3">
              <p className="break-words text-3xl font-semibold text-foreground">{judgment.riskPosture}</p>
              <Badge variant="secondary">{judgment.marketMood}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{judgment.confirmationStatus}</p>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <JudgmentRow icon={Target} label="Best Action" value={judgment.bestAction} strong />
            <JudgmentRow icon={EyeOff} label="Ignore" value={judgment.whatToIgnore} />
            <div className="min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/70 p-4">
              <div className="mb-3 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Radar className="size-4 text-nexus-champagne" />
                Watch
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {judgment.watchTriggers.map((trigger) => (
                  <Badge key={trigger} variant="secondary" className="whitespace-normal">
                    {trigger}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JudgmentRow({
  icon: Icon,
  label,
  strong = false,
  value,
}: {
  icon: ElementType;
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/70 p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="size-4 text-nexus-champagne" />
        {label}
      </div>
      <p className={strong ? "break-words text-base font-semibold leading-6 text-foreground" : "break-words text-sm leading-6 text-muted-foreground"}>
        {value}
      </p>
    </div>
  );
}

function getCachedJudgmentInputs(): JudgmentInputs {
  const marketResponse = getCachedMarketsData();
  const cryptoResponse = getCachedCryptoData();
  const newsResponse = getCachedNewsData();

  return {
    cryptoAssets: cryptoResponse?.data.assets ?? [],
    marketAssets: marketResponse?.data.assets ?? [],
    riskSignals: newsResponse?.data.riskSignals ?? [],
    stories: newsResponse?.data.stories ?? [],
  };
}

function getPostureBadgeVariant(judgment: NexusJudgment) {
  if (judgment.riskPosture === "Crisis" || judgment.riskPosture === "Defensive") return "danger";
  if (judgment.riskPosture === "Elevated") return "warning";
  if (judgment.riskPosture === "Calm") return "success";
  return "default";
}
