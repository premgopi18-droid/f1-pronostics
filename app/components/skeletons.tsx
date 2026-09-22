import { Skeleton, SkeletonCard, SkeletonCircle } from '@/app/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Fragments de skeleton partagés par les `loading.tsx` (#241) : headers, barres
 * d'onglets, listes… Les hauteurs ci-dessous sont alignées sur les composants
 * réels qu'elles imitent — une seule source pour que les skeletons ne dérivent
 * pas des écrans quand un composant change.
 */

/** Bouton icône carré des headers (`iconButtonVariants`). */
const ICON_BUTTON_CLASS = 'h-9 w-9 rounded-xl'
/** Titre de page `font-display text-2xl` (line-height 2rem). */
const TITLE_2XL_CLASS = 'h-8'
/** Titre de page `font-display text-xl` (line-height 1.75rem). */
const TITLE_XL_CLASS = 'h-7'
/** Libellé de section `text-2xs uppercase`. */
const SECTION_LABEL_CLASS = 'h-3 w-28'
/** Onglet d'une barre `role="tablist"` : `py-2` + `text-sm`. */
const TAB_CLASS = 'h-9 flex-1 rounded-lg'
/** Ligne de texte `text-sm`. */
export const TEXT_SM_CLASS = 'h-4'
/** Ligne de texte `text-xs` / `text-2xs`. */
export const TEXT_XS_CLASS = 'h-3'
/** Bouton `size: block` / `md` de `buttonVariants`. */
export const BUTTON_BLOCK_CLASS = 'h-[54px] w-full rounded-xl'
/** Bouton `size: sm` de `buttonVariants` (44px, cible tactile). */
export const BUTTON_SM_CLASS = 'h-11 w-full rounded-xl'

/** Header « titre + action à droite » (Ligues, Home). */
export function SkeletonTitleHeader({ action = false, className }: { action?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between py-2', className)}>
      <Skeleton className={cn(TITLE_2XL_CLASS, 'w-36')} />
      {action && <Skeleton className={ICON_BUTTON_CLASS} />}
    </div>
  )
}

/** Header « retour + titre (+ sous-titre) (+ action) » des pages détail. */
export function SkeletonBackHeader({
  subtitle = false,
  action = false,
  className,
}: {
  subtitle?: boolean
  action?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <Skeleton className={ICON_BUTTON_CLASS} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className={cn(TITLE_XL_CLASS, 'w-40')} />
        {subtitle && <Skeleton className={cn(TEXT_XS_CLASS, 'w-28')} />}
      </div>
      {action && <Skeleton className={ICON_BUTTON_CLASS} />}
    </div>
  )
}

/** Header compact « chevron + titre » des sous-pages profil (`mb-2` / `mb-6`). */
export function SkeletonChevronHeader({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Skeleton className="h-5 w-5" />
      <Skeleton className={cn(TITLE_XL_CLASS, 'w-44')} />
    </div>
  )
}

/** Libellé de section (`text-2xs uppercase`). */
export function SkeletonSectionLabel({ className }: { className?: string }) {
  return <Skeleton className={cn(SECTION_LABEL_CLASS, className)} />
}

/** Barre d'onglets (`role="tablist"` : bordure + `p-1`). */
export function SkeletonTabBar({ tabs, className }: { tabs: number; className?: string }) {
  return (
    <div className={cn('flex gap-1 rounded-xl border border-border bg-card p-1', className)}>
      {Array.from({ length: tabs }, (_, index) => (
        <Skeleton key={index} className={TAB_CLASS} />
      ))}
    </div>
  )
}

/** Pile de lignes-cards indépendantes (historique, calendrier, week-ends…). */
export function SkeletonRows({
  count,
  rowClassName = 'h-12',
  className,
}: {
  count: number
  rowClassName?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn('w-full rounded-xl', rowClassName)} />
      ))}
    </div>
  )
}

/** Liste dans une card unique, lignes séparées (réglages profil, résultats). */
export function SkeletonDividedList({
  count,
  rowClassName = 'py-4',
  className,
}: {
  count: number
  rowClassName?: string
  className?: string
}) {
  return (
    <SkeletonCard
      padding="none"
      className={cn('flex flex-col divide-y divide-border overflow-hidden', className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn('flex items-center gap-3 px-4', rowClassName)}>
          <Skeleton className="h-5 w-6" />
          <Skeleton className={cn(TEXT_SM_CLASS, 'flex-1')} />
          <Skeleton className={cn(TEXT_SM_CLASS, 'w-10')} />
        </div>
      ))}
    </SkeletonCard>
  )
}

/** Classement d'une ligue (`LeaderboardRealtime`) : rang, avatar, nom + barre, score. */
export function SkeletonLeaderboard({ rows, avatarSize }: { rows: number; avatarSize: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
          <Skeleton className="h-4 w-5" />
          <SkeletonCircle size={avatarSize} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={cn(TEXT_SM_CLASS, 'w-24')} />
            <Skeleton className="h-0.5 w-full" />
          </div>
          <Skeleton className={cn(TEXT_SM_CLASS, 'w-8')} />
        </div>
      ))}
    </div>
  )
}

/** Card « GP suivant » gradient de la Home et de l'onglet Résultats. */
export function SkeletonNextGpCard({ withCountdown = false }: { withCountdown?: boolean }) {
  return (
    <SkeletonCard variant="gradient">
      <SkeletonSectionLabel className="w-24" />
      <Skeleton className={cn(TITLE_2XL_CLASS, 'mt-2 w-3/4')} />
      <Skeleton className={cn(TEXT_SM_CLASS, 'mt-2 w-1/2')} />
      {withCountdown && <Skeleton className="mt-4 h-16 w-full rounded-xl" />}
      <Skeleton className={cn(BUTTON_BLOCK_CLASS, 'mt-4')} />
    </SkeletonCard>
  )
}

/** Podium à trois marches (card « dernier GP », recap) — ordre 2e · 1er · 3e. */
export function SkeletonPodium({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-end justify-center gap-3', className)}>
      <Skeleton className="h-9 flex-1 rounded-t-lg rounded-b-none" />
      <Skeleton className="h-12 flex-1 rounded-t-lg rounded-b-none" />
      <Skeleton className="h-7 flex-1 rounded-t-lg rounded-b-none" />
    </div>
  )
}
