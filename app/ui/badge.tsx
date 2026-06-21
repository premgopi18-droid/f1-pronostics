import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight",
  {
    variants: {
      variant: {
        accent: "bg-accent-soft text-primary",
        gold: "bg-gold-soft text-gold",
        success: "border border-success text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-destructive/15 text-destructive",
        neutral: "border border-border bg-card text-text-secondary",
      },
    },
    defaultVariants: { variant: "accent" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
