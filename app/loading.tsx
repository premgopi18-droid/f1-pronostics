import { Skeleton, SkeletonCard, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import {
  SkeletonNextGpCard,
  SkeletonPodium,
  SkeletonRows,
  SkeletonSectionLabel,
  BUTTON_BLOCK_CLASS,
  CARD_SM_ONE_LINE_CLASS,
  TEXT_SM_CLASS,
} from '@/app/components/skeletons'

/** Taille de l'avatar du header Home (`UserAvatar size={40}`). */
const HEADER_AVATAR_SIZE = 40
/** Lignes « Mes ligues » esquissées. */
const LEAGUE_ROWS = 2

// Skeleton de la Home — même silhouette que app/page.tsx (header, card GP, dernier GP,
// CTAs ligues, accès rapides). Sert aussi de fallback aux routes sans loading.tsx dédié.
export default function HomeLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col gap-6 px-page pb-6 pt-3">
      {/* Header : salutation + pseudo, avatar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className={`${TEXT_SM_CLASS} w-16`} />
          <Skeleton className="h-8 w-32" />
        </div>
        <SkeletonCircle size={HEADER_AVATAR_SIZE} />
      </div>

      <SkeletonNextGpCard withCountdown />

      {/* Dernier GP : podium + score brut */}
      <SkeletonCard>
        <div className="flex items-center gap-2">
          <SkeletonSectionLabel className="w-20" />
          <Skeleton className={`${TEXT_SM_CLASS} w-32`} />
        </div>
        <SkeletonPodium className="mt-4" />
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
          <Skeleton className={`${TEXT_SM_CLASS} w-24`} />
          <Skeleton className="h-5 w-16" />
        </div>
      </SkeletonCard>

      {/* CTAs créer / rejoindre */}
      <div className="flex gap-2.5">
        <Skeleton className={`${BUTTON_BLOCK_CLASS} flex-1`} />
        <Skeleton className={`${BUTTON_BLOCK_CLASS} flex-1`} />
      </div>

      {/* Accès rapides : mes ligues + lien saison */}
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <SkeletonSectionLabel />
        <SkeletonRows count={LEAGUE_ROWS} rowClassName={CARD_SM_ONE_LINE_CLASS} />
        <Skeleton className={`${CARD_SM_ONE_LINE_CLASS} w-full`} />
      </div>
    </SkeletonPage>
  )
}
