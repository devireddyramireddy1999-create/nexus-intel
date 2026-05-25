import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/types/intel";

type MarketChartProps = {
  data: TrendPoint[];
  color?: string;
  height?: number;
  variant?: "area" | "line" | "bar";
  className?: string;
};

const tooltipStyle = {
  background: "rgba(8, 8, 8, 0.96)",
  border: "1px solid rgba(201, 166, 70, 0.28)",
  borderRadius: 8,
  color: "#F4EFE3",
};

export function MarketChart({ data, color = "#C9A646", height = 120, variant = "area", className }: MarketChartProps) {
  if (data.length < 2) {
    return (
      <div
        className={cn(
          "flex min-w-0 w-full items-center justify-center rounded-md border border-primary/[0.12] bg-[#050505]/70 text-xs uppercase tracking-[0.18em] text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Latest quote only
      </div>
    );
  }

  return (
    <div className={cn("h-32 min-w-0 w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip cursor={{ fill: "rgba(201,166,70,0.08)" }} contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : variant === "line" ? (
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`chart-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#chart-${color.replace("#", "")})`}
              dot={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
