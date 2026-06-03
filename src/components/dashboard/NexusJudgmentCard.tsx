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
  const reasonCodes = useMemo(() => buildJudgmentReasons(inputs, changeInsights), [changeInsights, inputs]);

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
        <div className="mt-4 min-w-0 rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/60 p-3">
          <div className="mb-2 flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <BrainCircuit className="size-4 text-nexus-champagne" />
            Why this judgment
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {reasonCodes.map((reason) => (
              <Badge key={reason} variant="secondary" className="whitespace-normal">
                {reason}
              </Badge>
            ))}
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

function buildJudgmentReasons(inputs: JudgmentInputs, changeInsights: ChangeInsight[]) {
  const assets = mergeAssets(inputs.marketAssets, inputs.cryptoAssets);
  const reasons: string[] = [];
  const equities = averageChange(assets, ["SPX", "NDX"]);
  const crypto = averageChange(assets, ["BTC", "ETH", "SOL"]);
  const btcEth = averageChange(assets, ["BTC", "ETH"]);
  const oil = getChange(assets, "WTI");
  const gold = getChange(assets, "XAU");
  const riskScore = inputs.riskSignals.find((signal) => /global/i.test(signal.label))?.value ?? inputs.riskSignals[0]?.value;
  const repeatedTheme =
    changeInsights.some((insight) => insight.classification === "Repeated theme") ||
    inputs.stories.some((story) => (story.sourceCount ?? story.coveredBy?.length ?? 1) >= 3);

  if (isNegative(btcEth, -0.35) || isNegative(crypto, -0.35)) reasons.push("BTC/ETH weakness");
  if (isNegative(equities, -0.2)) reasons.push("SPY/QQQ softness");
  if (isPositive(oil, 0.6)) reasons.push("Oil strength adds macro pressure");
  if (isPositive(gold, 0.3) && !isPositive(equities, 0.15)) reasons.push("Gold/equity split suggests caution");
  if (hasRiskHeadline(inputs.stories) || isAtLeast(riskScore, 60)) reasons.push("Geopolitical headlines elevated");
  if (repeatedTheme) reasons.push("Repeated theme across sources");
  if (!reasons.length && Number.isFinite(equities) && Number.isFinite(crypto)) reasons.push("Cross-asset signals are mixed");

  return uniqueValues(reasons).slice(0, 4).length ? uniqueValues(reasons).slice(0, 4) : ["Based on available market and brief signals"];
}

function mergeAssets(marketAssets: MarketAsset[], cryptoAssets: MarketAsset[]) {
  const assetsBySymbol = new Map<string, MarketAsset>();

  for (const asset of marketAssets) assetsBySymbol.set(asset.symbol, asset);
  for (const asset of cryptoAssets) assetsBySymbol.set(asset.symbol, asset);

  return [...assetsBySymbol.values()];
}

function averageChange(assets: MarketAsset[], symbols: string[]) {
  const values = symbols.map((symbol) => getChange(assets, symbol)).filter(Number.isFinite);
  if (!values.length) return Number.NaN;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getChange(assets: MarketAsset[], symbol: string) {
  const value = assets.find((asset) => asset.symbol === symbol)?.change;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function hasRiskHeadline(stories: IntelligenceStory[]) {
  return stories.some((story) => {
    const text = `${story.section} ${story.title} ${story.summary} ${story.impact}`.toLowerCase();
    return /\b(war|conflict|sanction|military|oil|shipping|security|iran|hormuz|russia|ukraine|inflation|rates|central bank)\b/.test(text);
  });
}

function isAtLeast(value: number | undefined, threshold: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= threshold;
}

function isPositive(value: number, threshold: number) {
  return Number.isFinite(value) && value > threshold;
}

function isNegative(value: number, threshold: number) {
  return Number.isFinite(value) && value < threshold;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
