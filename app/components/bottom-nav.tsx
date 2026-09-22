"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, ClipboardList, Flag, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActiveRoute, isHiddenRoute, isHighlightedTab } from "@/lib/nav";
import { t, type TranslationKey } from "@/lib/i18n";

/**
 * Hauteur de la barre — réutilisée pour réserver l'espace en bas du flux.
 * 64px de contenu + safe-area (home indicator iOS) : avec `box-sizing: border-box`,
 * le `pb-[env(safe-area-inset-bottom)]` de la nav est compté dans cette hauteur,
 * donc on l'ajoute ici pour laisser 64px utiles aux icônes.
 */
const NAV_HEIGHT = "h-[calc(4rem+env(safe-area-inset-bottom,0px))]";

/** Taille des icônes d'onglet. */
const TAB_ICON_SIZE = 22;
/** Épaisseur de trait de l'icône : onglet allumé / éteint. */
const TAB_ICON_STROKE_HIGHLIGHTED = 2.4;
const TAB_ICON_STROKE_DEFAULT = 2;

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
  // Onglet dont la navigation est en cours (tap → changement d'URL). Alimenté par chaque
  // `TabContent` via `useLinkStatus` : l'onglet visé s'allume dès le tap même quand le
  // shell n'est pas préfetché (#241). Quand il l'est (cas courant grâce aux loading.tsx),
  // `pathname` change immédiatement et Next saute l'état pending. `null` hors navigation.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  if (isHiddenRoute(pathname, HIDDEN_PREFIXES)) return null;

  return (
    <>
      {/* réserve l'espace pour que le contenu ne passe pas sous la barre fixe */}
      <div className={NAV_HEIGHT} aria-hidden />
      <nav
        aria-label={t("nav.label")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card",
          // marge de sécurité pour les encoches / barres système (PWA)
          "pb-[env(safe-area-inset-bottom,0px)]",
          // Contournement bug WebKit iOS 26 (#196, WebKit #297779) : les éléments `fixed`
          // « décrochent » du viewport au scroll (barre coincée en plein écran) quand l'UI
          // du navigateur se replie/déplie. La promotion sur son propre layer de composition
          // force WebKit à repositionner la barre via le compositeur.
          "transform-gpu",
          NAV_HEIGHT,
        )}
      >
        {TABS.map((tab) => {
          // `aria-current` reste porté par le chemin réel (sémantique) ; la
          // surbrillance, elle, anticipe la destination pendant la navigation.
          const active = isActiveRoute(pathname, tab.href, tab.exact);
          const highlighted = isHighlightedTab(pathname, tab, pendingHref);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "pressable flex flex-1 flex-col items-center justify-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              <TabContent tab={tab} highlighted={highlighted} onPendingChange={setPendingHref} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * Contenu d'un onglet — composant séparé car `useLinkStatus` doit être appelé
 * dans un descendant du `<Link>`. Remonte l'état pending au parent pour que la
 * surbrillance soit exclusive (un seul onglet allumé à la fois).
 */
function TabContent({
  tab,
  highlighted,
  onPendingChange,
}: {
  tab: Tab;
  highlighted: boolean;
  onPendingChange: Dispatch<SetStateAction<string | null>>;
}) {
  const { pending } = useLinkStatus();
  const { Icon } = tab;

  useEffect(() => {
    onPendingChange((current) => {
      if (pending) return tab.href;
      // Fin de navigation : ne relâche que si c'est bien cet onglet qui était visé.
      return current === tab.href ? null : current;
    });
  }, [pending, tab.href, onPendingChange]);

  return (
    <span
      className={cn(
        // Remplit tout le Link (64px) : le survol de la zone hors icône + label change aussi la couleur.
        "flex h-full w-full flex-col items-center justify-center gap-1 text-2xs font-semibold transition-colors",
        highlighted ? "text-primary-text" : "text-text-muted hover:text-text-secondary",
      )}
    >
      {/* Pulse discret tant que l'URL n'a pas changé (= tant que le skeleton n'est pas
          affiché). Sauté par Next si le shell est déjà préfetché — n'intervient donc
          que quand le préfetch n'a pas abouti (réseau lent). Coupé en mode réduit. */}
      <Icon
        size={TAB_ICON_SIZE}
        strokeWidth={highlighted ? TAB_ICON_STROKE_HIGHLIGHTED : TAB_ICON_STROKE_DEFAULT}
        className={cn(pending && "animate-pulse")}
        aria-hidden
      />
      {t(tab.labelKey)}
    </span>
  );
}
