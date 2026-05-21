import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-left text-xs font-medium leading-tight transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary",
        secondary: "border-white/10 bg-white/[0.07] text-muted-foreground",
        success: "border-nexus-good/30 bg-nexus-good/10 text-nexus-good",
        warning: "border-nexus-ember/35 bg-nexus-ember/10 text-nexus-ember",
        danger: "border-nexus-danger/35 bg-nexus-danger/10 text-nexus-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
