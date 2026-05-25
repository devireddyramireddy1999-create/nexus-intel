import { useEffect, useState } from "react";
import { Activity, Coins, Gauge } from "lucide-react";
import { MarketChart } from "@/components/charts/MarketChart";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatSigned } from "@/lib/utils";
import { getCachedCryptoData, getCryptoData, type ApiMeta } from "@/services/backendApi";
import type { CryptoSignal, MarketAsset } from "@/types/intel";

export function CryptoPage() {
  const [initialState] = useState(() => getCachedCryptoState());
  const [cryptoAssets, setCryptoAssets] = useState<MarketAsset[]>(initialState.assets);
  const [radar, setRadar] = useState<CryptoSignal[]>(initialState.radar);
  const [meta, setMeta] = useState<ApiMeta | null>(initialState.meta);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCryptoData()
      .then((response) => {
        if (!active) return;
        setCryptoAssets(response.data.assets);
        setRadar(response.data.radar);
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
        eyebrow="Crypto"
        title="Crypto Radar"
        description="Spot flow, risk appetite, leverage discipline, and protocol-level momentum for the crypto sleeve."
        icon={Coins}
        badge={loading ? (meta?.stale ? "Last live snapshot — refreshing..." : "Loading live intelligence...") : isLiveCrypto(meta) ? getLiveCryptoLabel(meta) : "Live feeds unavailable — fallback mode"}
      />
      {meta?.error ? <p className="mb-4 text-xs text-nexus-ember">{getCryptoErrorMessage(meta)}</p> : null}
      {loading && !cryptoAssets.length ? <p className="mb-4 text-sm text-muted-foreground">Warming live intelligence feeds...</p> : null}
      <div className="grid gap-5 lg:grid-cols-3">
        {cryptoAssets.map((asset) => (
          <Card key={asset.symbol}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{asset.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{asset.symbol}</p>
                </div>
                <Badge variant={asset.changeAvailable === false ? "secondary" : asset.change >= 0 ? "success" : "danger"}>
                  {asset.changeAvailable === false ? "24h n/a" : formatSigned(asset.change)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{asset.value}</p>
              <MarketChart data={asset.series} />
              <p className="text-sm leading-6 text-muted-foreground">{asset.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conviction Scores</CardTitle>
              <Gauge className="size-5 text-nexus-champagne" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {radar.map((signal) => (
              <div key={signal.asset}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{signal.asset}</p>
                  <p className="text-sm text-muted-foreground">{signal.score}/100</p>
                </div>
                <Progress value={signal.score} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Radar Notes</CardTitle>
              <Activity className="size-5 text-nexus-gold" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {radar.map((signal) => (
              <article key={signal.asset} className="rounded-lg border border-primary/[0.14] bg-[#0a0a0a]/75 p-4">
                <Badge>{signal.asset}</Badge>
                <h2 className="mt-3 text-base font-semibold text-foreground">{signal.thesis}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.flow}</p>
                <p className="mt-3 border-l border-nexus-danger/40 pl-3 text-sm leading-6 text-foreground">{signal.risk}</p>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function getCachedCryptoState() {
  const cached = getCachedCryptoData();

  return {
    assets: cached?.data.assets ?? [],
    meta: cached?.meta ?? null,
    radar: cached?.data.radar ?? [],
  };
}

function isLiveCrypto(meta: ApiMeta | null) {
  return (meta?.source === "coingecko" || meta?.source === "coinbase") && meta.fallback === false;
}

function getLiveCryptoLabel(meta: ApiMeta | null) {
  return meta?.source === "coinbase" ? "Live Coinbase spot" : "Live CoinGecko";
}

function getCryptoErrorMessage(meta: ApiMeta) {
  if (meta.error?.startsWith("Backend request failed") || meta.error?.includes("Failed to fetch")) {
    return "Crypto backend unavailable after retries. Showing fallback mode.";
  }

  return "Live crypto feed unavailable after retries. Showing fallback mode.";
}
