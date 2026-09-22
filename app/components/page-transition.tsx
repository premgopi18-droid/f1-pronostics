'use client'

import { ViewTransition } from 'react'
import type { ReactNode } from 'react'

/**
 * Classe de transition de vue posée sur le contenu de page — cible des règles
 * `::view-transition-old/new(.bx-page)` de globals.css (fondu de sortie rapide,
 * entrée en fondu + léger glissement). Une seule source : changer ici ET dans le CSS.
 */
const PAGE_VIEW_TRANSITION_CLASS = 'bx-page'

/**
 * Enveloppe le contenu de page dans un `<ViewTransition>` React (#242), monté par
 * `app/template.tsx` — donc ré-instancié à chaque navigation. Seuls `enter` (nouvelle
 * page) et `exit` (ancienne page) sont animés ; `default="none"` coupe le cas `update` :
 * une mutation en transition à l'intérieur de la page (`useOptimistic`, `router.refresh`,
 * révélation Suspense skeleton → contenu) ne déclenche PAS de fondu plein écran, et
 * l'ancienne page sort à sa propre géométrie (pas de morph, pas de désalignement si
 * elle était scrollée). La bottom nav vit hors de cette enveloppe et reste ancrée.
 * Navigateurs sans View Transitions API : cut sec, comme avant.
 * Composant dédié : isole l'API React canary (typée via types/react-canary.d.ts).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={PAGE_VIEW_TRANSITION_CLASS}
      exit={PAGE_VIEW_TRANSITION_CLASS}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
