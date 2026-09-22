import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { cardVariants, type CardProps } from '@/app/ui/card'

/**
 * Primitives de chargement (skeletons) — fallback des `loading.tsx` de chaque route
 * (#241). Un skeleton reprend la silhouette de l'écran qu'il remplace (mêmes
 * gouttières, mêmes hauteurs de lignes) : l'utilisateur voit la page « se dessiner »
 * dès le tap, puis le contenu réel se substitue sans saut de mise en page.
 *
 * Le pulse (`animate-pulse`) est coupé par les deux déclencheurs de réduction
 * d'animations (préférence système et classe `.reduce-motion`, cf. globals.css) :
 * le bloc reste alors statique.
 */

/** Bloc élémentaire : surface neutre qui pulse. Décoratif (`aria-hidden`) — l'état
 *  de chargement est annoncé une seule fois par `SkeletonPage`. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-lg bg-secondary', className)} style={style} />
  )
}

/** Pastille ronde à taille fixe (avatar, bulle, feu). */
export function SkeletonCircle({ size, className }: { size: number; className?: string }) {
  return (
    <Skeleton className={cn('shrink-0 rounded-full', className)} style={{ width: size, height: size }} />
  )
}

/** Contour identique à `Card` (rayon, bordure, padding) : le skeleton occupe
 *  exactement la place de la card qu'il remplace. */
export function SkeletonCard({ padding, variant, className, children }: CardProps) {
  return (
    <div aria-hidden className={cn(cardVariants({ padding, variant }), className)}>
      {children}
    </div>
  )
}

/** Conteneur de page en chargement : reprend les classes du `<main>` de la page
 *  cible (gouttières, gaps) et annonce l'état aux lecteurs d'écran. */
export function SkeletonPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main aria-busy="true" className={className}>
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      {children}
    </main>
  )
}
