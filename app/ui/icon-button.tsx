import { cva } from "class-variance-authority";

/**
 * Bouton/lien icône carré des headers de page (retour, réglages…).
 * S'utilise via className — fonctionne pour `<Link>` comme pour `<button>` :
 *   <Link className={iconButtonVariants({ tone: "muted" })} aria-label={…}>
 * Toujours fournir un `aria-label` : un bouton icône n'a pas de texte visible.
 */
export const iconButtonVariants = cva(
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      tone: {
        default: "text-foreground",
        muted: "text-text-secondary",
      },
      bordered: {
        true: "border border-border",
        false: "",
      },
    },
    defaultVariants: { tone: "default", bordered: false },
  },
);
