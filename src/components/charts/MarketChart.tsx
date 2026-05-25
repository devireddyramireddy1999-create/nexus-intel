import { useId, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/types/intel";

type MarketChartProps = {
  data: TrendPoint[];
  color?: string;
  height?: number;
  maxPoints?: number;
  normalize?: boolean;
  variant?: "area" | "line" | "bar";
  className?: string;
};

type DisplayPoint = TrendPoint & {
  rawValue: number;
};

const tooltipStyle = {
  background: "rgba(8, 8, 8, 0.96)",
  border: "1px solid rgba(201, 166, 70, 0.28)",
  borderRadius: 8,
  color: "#F4EFE3",
};

const chartColors = {
  down: "#ff5f7a",
  flat: "#C9A646",
  up: "#4bf4a8",
};

export function MarketChart({
  data,
  color = "#C9A646",
  height = 96,
  maxPoints = 48,
  normalize = true,
  variant = "area",
  className,
}: MarketChartProps) {
  const gradientId = `market-chart-${useId().replace(/:/g, "")}`;
  const displayData = useMemo(() => prepareDisplayData(data, { maxPoints, normalize }), [data, maxPoints, normalize]);
  const chartColor = normalize ? getSeriesColor(data) : color;

  if (displayData.length < 2) {
    return (
      <div
        className={cn(
          "flex min-w-0 w-full items-center justify-center rounded-md border border-primary/[0.10] bg-[#050505]/55 px-3 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Chart unavailable — latest quote only
      </div>
    );
  }

  return (
    <div
      className={cn("min-w-0 w-full overflow-hidden rounded-md border border-primary/[0.10] bg-[#050505]/55", className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={displayData} margin={{ bottom: 8, left: 0, right: 0, top: 8 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              cursor={{ fill: "rgba(201,166,70,0.08)" }}
              contentStyle={tooltipStyle}
              formatter={(value) => formatTooltipValue(value, normalize)}
            />
            <Bar dataKey="value" fill={chartColor} radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={displayData} margin={{ bottom: 8, left: 0, right: 0, top: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.28} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltipValue(value, normalize)} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2.2}
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function prepareDisplayData(data: TrendPoint[], { maxPoints, normalize }: { maxPoints: number; normalize: boolean }): DisplayPoint[] {
  const cleanData = data
    .map((point) => ({
      rawValue: Number(point.value),
      time: String(point.time ?? ""),
      value: Number(point.value),
    }))
    .filter((point) => point.time && Number.isFinite(point.rawValue));

  const thinnedData = thinSeries(cleanData, maxPoints);
  if (!normalize) return thinnedData;

  const firstValue = thinnedData[0]?.rawValue;
  if (!Number.isFinite(firstValue) || firstValue === 0) return [];

  return thinnedData.map((point) => ({
    ...point,
    value: Number((((point.rawValue - firstValue) / Math.abs(firstValue)) * 100).toFixed(4)),
  }));
}

function thinSeries<T>(series: T[], maxPoints: number) {
  if (series.length <= maxPoints) return series;

  const interval = (series.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => series[Math.round(index * interval)]).filter(Boolean);
}

function getSeriesColor(data: TrendPoint[]) {
  const cleanValues = data.map((point) => Number(point.value)).filter(Number.isFinite);
  const firstValue = cleanValues[0];
  const lastValue = cleanValues.at(-1);

  if (
    typeof firstValue !== "number" ||
    typeof lastValue !== "number" ||
    !Number.isFinite(firstValue) ||
    !Number.isFinite(lastValue) ||
    firstValue === 0
  ) return chartColors.flat;

  const percentChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
  if (percentChange > 0.05) return chartColors.up;
  if (percentChange < -0.05) return chartColors.down;
  return chartColors.flat;
}

function formatTooltipValue(value: unknown, normalize: boolean) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";

  return normalize ? `${numericValue.toFixed(2)}%` : numericValue.toFixed(2);
}
