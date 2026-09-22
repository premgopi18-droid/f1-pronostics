'use client'

import { ViewTransition } from 'react'
import type { ReactNode } from 'react'

/**
 * Classe de transition de vue posée sur le contenu de page — cible des règles
 * `::view-transition-*(.bx-page)` de globals.css (fondu de sortie rapide, entrée
 * en fondu + léger glissement). Une seule source : changer ici ET dans le CSS.
 */
const PAGE_VIEW_TRANSITION_CLASS = 'bx-page'

/**
 * Enveloppe le contenu de page dans un `<ViewTransition>` React (#242). Activé par
 * `experimental.viewTransition` (next.config.ts) : les navigations Next sont des
 * transitions, donc l'animation joue au changement de page ET au remplacement
 * skeleton → contenu (révélation Suspense). La bottom nav vit hors de cette enveloppe
 * et reste ancrée. Navigateurs sans View Transitions API : cut sec, comme avant.
 * Composant dédié : isole l'API React canary (typée via types/react-canary.d.ts) dans
 * un seul fichier au lieu de l'exposer dans le layout.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <ViewTransition default={PAGE_VIEW_TRANSITION_CLASS}>{children}</ViewTransition>
}
