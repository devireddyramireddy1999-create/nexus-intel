import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { MarketChart } from "@/components/charts/MarketChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { marketAssets } from "@/data/mockData";
import { cn, formatSigned } from "@/lib/utils";

export function MarketSnapshot() {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.26em] text-nexus-cyan">Market Snapshot</p>
          <h2 className="mt-1 break-words text-xl font-semibold text-foreground">Cross-Asset Pulse</h2>
        </div>
        <Badge variant="secondary">Mock feed</Badge>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {marketAssets.map((asset, index) => {
          const positive = asset.change >= 0;
          const color = positive ? "#4bf4a8" : "#ff5f7a";
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
                        positive ? "bg-nexus-good/10 text-nexus-good" : "bg-nexus-danger/10 text-nexus-danger",
                      )}
                    >
                      {positive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                      {formatSigned(asset.change)}
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
