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
  background: "rgba(5, 10, 18, 0.92)",
  border: "1px solid rgba(32, 246, 255, 0.2)",
  borderRadius: 8,
  color: "#ecfeff",
};

export function MarketChart({ data, color = "#20f6ff", height = 120, variant = "area", className }: MarketChartProps) {
  return (
    <div className={cn("h-32 min-w-0 w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip cursor={{ fill: "rgba(32,246,255,0.08)" }} contentStyle={tooltipStyle} />
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
