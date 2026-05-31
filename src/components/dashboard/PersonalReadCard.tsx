import { useEffect, useMemo, useState, type ElementType } from "react";
import { Compass, Crosshair, EyeOff, TimerReset, UserRound } from "lucide-react";
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
import {
  buildPersonalRead,
  getPersonalContext,
  hasPersonalContext,
  PERSONAL_CONTEXT_EVENT,
} from "@/services/personalContextService";
import type { ChangeInsight, IntelligenceStory, MarketAsset, PersonalContext, RiskSignal } from "@/types/intel";

type PersonalReadCardProps = {
  changeInsights?: ChangeInsight[];
};

type PersonalReadInputs = {
  cryptoAssets: MarketAsset[];
  marketAssets: MarketAsset[];
  riskSignals: RiskSignal[];
  stories: IntelligenceStory[];
};

export function PersonalReadCard({ changeInsights = [] }: PersonalReadCardProps) {
  const [context, setContext] = useState<PersonalContext>(() => getPersonalContext());
  const [inputs, setInputs] = useState<PersonalReadInputs>(() => getCachedInputs());
  const [loading, setLoading] = useState(true);
  const contextActive = hasPersonalContext(context);
  const judgment = useMemo(
    () => buildNexusJudgment({ ...inputs, changeInsights }),
    [changeInsights, inputs],
  );
  const read = useMemo(() => buildPersonalRead(context, judgment), [context, judgment]);

  useEffect(() => {
    const handlePersonalContext = () => setContext(getPersonalContext());

    window.addEventListener(PERSONAL_CONTEXT_EVENT, handlePersonalContext);
    return () => window.removeEventListener(PERSONAL_CONTEXT_EVENT, handlePersonalContext);
  }, []);

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
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.22em] text-nexus-champagne sm:tracking-[0.26em]">
              <UserRound className="size-4" />
              Personal Read
            </div>
            <CardTitle>Ram Command Layer</CardTitle>
          </div>
          <Badge variant={contextActive ? "success" : "secondary"}>
            {loading ? "Reading" : contextActive ? "Context active" : "Context needed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-3 lg:grid-cols-5">
          <PersonalReadItem className="lg:col-span-2" icon={Compass} label="Priority" value={read.priority} strong={contextActive} />
          <PersonalReadItem className="lg:col-span-3" icon={Crosshair} label="Best Action" value={read.bestAction} strong />
          <PersonalReadItem className="lg:col-span-2" icon={EyeOff} label="Avoid" value={read.thingToAvoid} />
          <PersonalReadItem className="lg:col-span-2" icon={UserRound} label="Impact" value={read.impact} />
          <PersonalReadItem className="lg:col-span-1" icon={TimerReset} label="Focus Block" value={read.focusBlock} />
        </div>
      </CardContent>
    </Card>
  );
}

function PersonalReadItem({
  className = "",
  icon: Icon,
  label,
  strong = false,
  value,
}: {
  className?: string;
  icon: ElementType;
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-3 ${className}`}>
      <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="size-4 shrink-0 text-nexus-champagne" />
        {label}
      </div>
      <p className={strong ? "break-words text-sm font-semibold leading-6 text-foreground" : "break-words text-sm leading-6 text-muted-foreground"}>
        {value}
      </p>
    </div>
  );
}

function getCachedInputs(): PersonalReadInputs {
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
