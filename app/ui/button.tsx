import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // base : layout, focus visible (a11y), transitions, état désactivé
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Action principale — rouge F1 */
        accent: "bg-primary text-primary-foreground hover:bg-primary/90",
        /** Action secondaire — surface bordée */
        secondary: "border border-border bg-card text-foreground hover:bg-secondary/40",
        /** Tertiaire — contour discret */
        ghost: "border border-border bg-transparent text-text-secondary hover:bg-card",
        /** CTA sur fond sombre (ex. « Continuer avec Google ») */
        light: "bg-white text-zinc-900 hover:bg-white/90",
      },
      size: {
        // h-11 = 44px : cible tactile minimale accessible
        sm: "h-11 px-4 text-sm",
        md: "h-[54px] px-5 text-[15px]",
        /** Pleine largeur — CTA de bas d'écran */
        block: "h-[54px] w-full text-base",
      },
    },
    defaultVariants: { variant: "accent", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({ className, variant, size, ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
