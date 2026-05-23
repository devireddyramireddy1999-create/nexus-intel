import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 min-w-0 shrink-0 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:text-sm [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[#D8C27A]/35 bg-[linear-gradient(135deg,#DCC464,#AD8326)] text-[#050505] shadow-[0_12px_28px_rgba(201,166,70,0.12)] hover:brightness-105",
        secondary:
          "border border-primary/[0.16] bg-[#050505]/80 text-secondary-foreground shadow-none hover:border-primary/[0.28] hover:bg-[#0a0a0a]",
        ghost: "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        outline:
          "border border-primary/[0.22] bg-transparent text-nexus-champagne shadow-none hover:border-primary/35 hover:bg-white/[0.035] hover:text-nexus-champagne",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-5",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
