import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value, ...props }, ref) => (
  <div ref={ref} className={cn("h-2 w-full overflow-hidden rounded-full bg-[#111111]", className)} {...props}>
    <div
      className="h-full rounded-full bg-gradient-to-r from-nexus-champagne to-nexus-gold transition-all duration-700"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
));
Progress.displayName = "Progress";

export { Progress };
