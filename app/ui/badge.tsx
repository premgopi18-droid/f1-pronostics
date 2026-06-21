import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Toutes les variantes suivent le même mécanisme : fond « soft » (~15%) + texte coloré.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-semibold leading-tight",
  {
    variants: {
      variant: {
        accent: "bg-accent-soft text-primary",
        gold: "bg-gold-soft text-gold",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive",
        neutral: "bg-secondary text-text-secondary",
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
