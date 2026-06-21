import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-2xl border border-border", {
  variants: {
    variant: {
      default: "bg-card",
      /** Card mise en avant — léger dégradé (proto : prochain GP, ligue) */
      gradient: "bg-[linear-gradient(160deg,var(--surface-2),var(--card))]",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
    },
  },
  defaultVariants: { variant: "default", padding: "md" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, padding, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, padding }), className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between", className)} {...props} />;
}

/** Titre de card — police d'affichage (Titillium) */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("font-display text-lg font-bold text-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-text-secondary", className)} {...props} />;
}
