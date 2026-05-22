import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { MarketChart } from "@/components/charts/MarketChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { marketAssets } from "@/data/mockData";
import { cn, formatSigned } from "@/lib/utils";
import { getCryptoData, getMarketsData, getNewsData, type ApiMeta } from "@/services/backendApi";
import type { MarketAsset } from "@/types/intel";

export function MarketSnapshot() {
  const [assets, setAssets] = useState<MarketAsset[]>(marketAssets);
  const [marketMeta, setMarketMeta] = useState<ApiMeta | null>(null);
  const [cryptoMeta, setCryptoMeta] = useState<ApiMeta | null>(null);
  const [newsMeta, setNewsMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([getMarketsData(), getCryptoData(), getNewsData()])
      .then(([marketResponse, cryptoResponse, newsResponse]) => {
        if (!active) return;
        setAssets(mergeLiveCryptoAssets(marketResponse.data.assets, cryptoResponse.data.assets));
        setMarketMeta(marketResponse.meta);
        setCryptoMeta(cryptoResponse.meta);
        setNewsMeta(newsResponse.meta);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.26em] text-nexus-cyan">Market Snapshot</p>
          <h2 className="mt-1 break-words text-xl font-semibold text-foreground">Cross-Asset Pulse</h2>
        </div>
        <Badge
          variant={isFallbackSnapshot(marketMeta, cryptoMeta, newsMeta) ? "warning" : isLiveSnapshot(marketMeta, cryptoMeta, newsMeta) ? "success" : "secondary"}
        >
          {loading ? "Loading" : getSnapshotLabel(marketMeta, cryptoMeta, newsMeta)}
        </Badge>
      </div>
      {marketMeta?.error ? <p className="mb-3 text-xs text-nexus-ember">{getMarketErrorMessage(marketMeta)}</p> : null}
      {cryptoMeta?.error ? <p className="mb-3 text-xs text-nexus-ember">{getCryptoErrorMessage(cryptoMeta)}</p> : null}
      {newsMeta?.error ? <p className="mb-3 text-xs text-nexus-ember">{getNewsErrorMessage(newsMeta)}</p> : null}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {assets.map((asset, index) => {
          const hasChange = asset.changeAvailable !== false;
          const positive = asset.change >= 0;
          const color = !hasChange ? "#20f6ff" : positive ? "#4bf4a8" : "#ff5f7a";
          return (
            <motion.div
              key={asset.symbol}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.3 }}
            >
              <Card className="h-full min-w-0">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{asset.symbol}</CardTitle>
                      <p className="mt-1 break-words text-xs text-muted-foreground">{asset.name}</p>
                    </div>
                    <Badge variant={asset.category === "Crypto" ? "default" : "secondary"}>{asset.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <p className="break-words text-2xl font-semibold text-foreground">{asset.value}</p>
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold",
                        !hasChange
                          ? "bg-white/10 text-muted-foreground"
                          : positive
                            ? "bg-nexus-good/10 text-nexus-good"
                            : "bg-nexus-danger/10 text-nexus-danger",
                      )}
                    >
                      {hasChange ? positive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" /> : null}
                      {hasChange ? formatSigned(asset.change) : "24h n/a"}
                    </div>
                  </div>
                  <MarketChart data={asset.series} color={color} height={88} className="mt-4" />
                  <p className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">{asset.note}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function mergeLiveCryptoAssets(marketAssetsSnapshot: MarketAsset[], cryptoAssets: MarketAsset[]) {
  const cryptoBySymbol = new Map(cryptoAssets.map((asset) => [asset.symbol, asset]));
  return marketAssetsSnapshot.map((asset) => cryptoBySymbol.get(asset.symbol) ?? asset);
}

function isLiveCrypto(meta: ApiMeta | null) {
  return (meta?.source === "coingecko" || meta?.source === "coinbase") && meta.fallback === false;
}

function isLiveMarkets(meta: ApiMeta | null) {
  return meta?.source === "finnhub" && meta.fallback === false;
}

function isLiveNews(meta: ApiMeta | null) {
  return meta?.source === "rss" && meta.fallback === false;
}

function isLiveSnapshot(marketMeta: ApiMeta | null, cryptoMeta: ApiMeta | null, newsMeta: ApiMeta | null) {
  return isLiveCrypto(cryptoMeta) && isLiveMarkets(marketMeta) && isLiveNews(newsMeta);
}

function isFallbackSnapshot(marketMeta: ApiMeta | null, cryptoMeta: ApiMeta | null, newsMeta: ApiMeta | null) {
  return Boolean(marketMeta?.fallback || cryptoMeta?.fallback || newsMeta?.fallback);
}

function getSnapshotLabel(marketMeta: ApiMeta | null, cryptoMeta: ApiMeta | null, newsMeta: ApiMeta | null) {
  if (isLiveCrypto(cryptoMeta) && isLiveMarkets(marketMeta) && isLiveNews(newsMeta)) {
    return "Live crypto + live market proxies + live news";
  }
  if (isLiveCrypto(cryptoMeta) && isLiveMarkets(marketMeta)) return "Live crypto + live market proxies + mock news";
  if (isLiveCrypto(cryptoMeta)) return "Mixed: live crypto + mock markets";
  if (isLiveMarkets(marketMeta)) return "Mixed: mock crypto + live market proxies";
  if (marketMeta?.fallback || cryptoMeta?.fallback) return "Fallback: mock crypto + mock markets";
  return "Mixed feed";
}

function getMarketErrorMessage(meta: ApiMeta) {
  if (meta.error?.startsWith("Backend request failed") || meta.error?.includes("Failed to fetch")) {
    return "Markets backend unavailable. Showing local market fallback.";
  }

  return "Live market proxy feed unavailable. Showing local market fallback.";
}

function getCryptoErrorMessage(meta: ApiMeta) {
  if (meta.error?.startsWith("Backend request failed") || meta.error?.includes("Failed to fetch")) {
    return "Crypto backend unavailable. Showing mock crypto fallback.";
  }

  return "Live crypto feed unavailable. Showing mock crypto fallback.";
}

function getNewsErrorMessage(meta: ApiMeta) {
  if (meta.error?.startsWith("Backend request failed") || meta.error?.includes("Failed to fetch")) {
    return "News backend unavailable. Showing local news fallback.";
  }

  return "Live news feed unavailable. Showing local news fallback.";
}
