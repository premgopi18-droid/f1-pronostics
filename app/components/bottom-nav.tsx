"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, ClipboardList, Flag, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActiveRoute, isHiddenRoute } from "@/lib/nav";
import { t, type TranslationKey } from "@/lib/i18n";

/** Hauteur de la barre — réutilisée pour réserver l'espace en bas du flux. */
const NAV_HEIGHT = "h-16"; // 64px

type Tab = {
  href: string;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  /** Correspondance exacte (sinon on inclut les sous-routes). */
  exact?: boolean;
};

const TABS: readonly Tab[] = [
  { href: "/", labelKey: "nav.home", Icon: Home, exact: true },
  { href: "/leagues", labelKey: "nav.leagues", Icon: Trophy },
  { href: "/predictions", labelKey: "nav.predictions", Icon: ClipboardList },
  { href: "/results", labelKey: "nav.results", Icon: Flag },
  { href: "/profile", labelKey: "nav.profile", Icon: User },
];

/**
 * Préfixes de routes pré-authentification : la nav y est masquée (specs §7).
 * `/onboarding` et `/join` sont des routes planifiées (specs §7, archi `/join/page.tsx`)
 * pas encore implémentées — listées ici par anticipation.
 */
const HIDDEN_PREFIXES = ["/login", "/onboarding", "/join"];

export function BottomNav() {
  const pathname = usePathname();

  if (isHiddenRoute(pathname, HIDDEN_PREFIXES)) return null;

  return (
    <>
      {/* réserve l'espace pour que le contenu ne passe pas sous la barre fixe (64px + safe-area) */}
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))]" aria-hidden />
      <nav
        aria-label={t("nav.label")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card",
          // marge de sécurité pour les encoches / barres système (PWA)
          "pb-[env(safe-area-inset-bottom)]",
          NAV_HEIGHT,
        )}
      >
        {TABS.map((tab) => {
          const active = isActiveRoute(pathname, tab.href, tab.exact);
          const { Icon } = tab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-2xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active ? "text-primary" : "text-text-muted hover:text-text-secondary",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
