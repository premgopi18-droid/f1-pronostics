import { Skeleton, SkeletonCard, SkeletonPage } from '@/app/ui/skeleton'
import {
  SkeletonBackHeader,
  SkeletonLeaderboard,
  SkeletonRows,
  SkeletonSectionLabel,
  BUTTON_SM_CLASS,
} from '@/app/components/skeletons'
import { GP_ITEM_TYPES } from '@/lib/leagues/league-list'

/** Membres esquissés au classement. */
const LEADERBOARD_ROWS = 4
/** Avatar des lignes de classement (`UserAvatar size={32}`). */
const LEADERBOARD_AVATAR_SIZE = 32
/** Derniers GP de l'aperçu saison (`getLastFinalizedGps(gpList, 3)`). */
const PREVIEW_ROWS = 3

// Skeleton de la page ligue — header, bannière deadline, classement, items, aperçu saison.
// Sert aussi de fallback aux sous-routes de la ligue (GP, compare, items, admin).
export default function LeagueLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonBackHeader subtitle />
      <Skeleton className="mb-4 h-10 w-full rounded-xl" />

      <div className="flex flex-col gap-6">
        <section>
          <SkeletonSectionLabel className="mb-3" />
          <SkeletonLeaderboard rows={LEADERBOARD_ROWS} avatarSize={LEADERBOARD_AVATAR_SIZE} />
        </section>

        <section>
          <SkeletonSectionLabel className="mb-3" />
          <SkeletonCard padding="sm">
            <div className="flex justify-center gap-3">
              {GP_ITEM_TYPES.map((itemType) => (
                <div key={itemType} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-3" />
                </div>
              ))}
            </div>
            <Skeleton className={`${BUTTON_SM_CLASS} mt-4`} />
          </SkeletonCard>
        </section>

        <section>
          <SkeletonSectionLabel className="mb-3" />
          <SkeletonRows count={PREVIEW_ROWS} rowClassName="h-14" />
        </section>
      </div>
    </SkeletonPage>
  )
}
