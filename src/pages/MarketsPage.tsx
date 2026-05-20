import { useEffect, useState } from "react";
import { AreaChart, BarChart3, ChartCandlestick } from "lucide-react";
import { MarketChart } from "@/components/charts/MarketChart";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { macroTimeline as fallbackMacroTimeline, marketAssets as fallbackMarketAssets, sectorHeat as fallbackSectorHeat } from "@/data/mockData";
import { formatSigned } from "@/lib/utils";
import { getMarketsData, type ApiMeta } from "@/services/backendApi";
import type { MarketAsset } from "@/types/intel";

export function MarketsPage() {
  const [assets, setAssets] = useState<MarketAsset[]>(fallbackMarketAssets);
  const [heat, setHeat] = useState(fallbackSectorHeat);
  const [macro, setMacro] = useState(fallbackMacroTimeline);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const indexes = assets.filter((asset) => asset.category === "Index");
  const commodities = assets.filter((asset) => asset.category === "Commodity" || asset.category === "FX");

  useEffect(() => {
    let active = true;

    getMarketsData()
      .then((response) => {
        if (!active) return;
        setAssets(response.data.assets);
        setHeat(response.data.sectorHeat);
        setMacro(response.data.macroTimeline);
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
        eyebrow="Markets"
        title="Cross-Asset Market Console"
        description="Index momentum, commodity pressure, FX stability, and sector heat scored into a single operating view."
        icon={ChartCandlestick}
        badge={loading ? "Loading" : isLiveMarkets(meta) ? "Live Finnhub proxies" : "Fallback prices"}
      />
      {meta?.error ? <p className="mb-4 text-xs text-nexus-ember">{getMarketErrorMessage(meta)}</p> : null}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-nexus-cyan">Market Structure</p>
                <CardTitle className="mt-1">Index Leadership</CardTitle>
              </div>
              <AreaChart className="size-5 text-nexus-cyan" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            {indexes.map((asset) => (
              <div key={asset.symbol} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{asset.name}</p>
                    <p className="mt-1 text-3xl font-semibold text-foreground">{asset.value}</p>
                  </div>
                  <Badge variant={asset.change >= 0 ? "success" : "danger"}>{formatSigned(asset.change)}</Badge>
                </div>
                <MarketChart data={asset.series} color={asset.change >= 0 ? "#4bf4a8" : "#ff5f7a"} height={190} />
                <p className="text-sm leading-6 text-muted-foreground">{asset.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-nexus-cyan">Heat Map</p>
                <CardTitle className="mt-1">Sector Signal</CardTitle>
              </div>
              <BarChart3 className="size-5 text-nexus-blue" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {heat.map((sector) => (
              <div key={sector.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{sector.name}</span>
                  <span className="text-muted-foreground">{sector.value}</span>
                </div>
                <Progress value={sector.value} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {commodities.map((asset) => (
          <Card key={asset.symbol}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{asset.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{asset.symbol}</p>
                </div>
                <Badge variant={asset.change >= 0 ? "success" : "danger"}>{formatSigned(asset.change)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{asset.value}</p>
              <MarketChart
                data={asset.series}
                color={asset.change >= 0 ? "#20f6ff" : "#ff5f7a"}
                variant="line"
                height={120}
                className="mt-3"
              />
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{asset.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Macro Session Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <MarketChart
              data={macro.map((item) => ({ time: item.name, value: item.risk + item.liquidity + item.growth }))}
              color="#2b8cff"
              variant="bar"
              height={280}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function isLiveMarkets(meta: ApiMeta | null) {
  return meta?.source === "finnhub" && meta.fallback === false;
}

function getMarketErrorMessage(meta: ApiMeta) {
  if (meta.error?.startsWith("Backend request failed") || meta.error?.includes("Failed to fetch")) {
    return "Markets backend unavailable. Showing local fallback.";
  }

  return "Live market proxy feed unavailable. Showing local fallback.";
}
