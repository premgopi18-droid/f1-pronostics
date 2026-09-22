import { Skeleton, SkeletonCard, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonTitleHeader, TEXT_XS_CLASS } from '@/app/components/skeletons'
import { GP_ITEM_TYPES } from '@/lib/leagues/league-list'

/** Cards ligue esquissées (la plupart des joueurs ont 1 à 2 ligues). */
const LEAGUE_CARDS = 2

// Skeleton de l'onglet Ligues — silhouette de `LeagueCard` (nom, rang / points, bulles items).
export default function LeaguesLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonTitleHeader action />
      <div className="mt-2 flex flex-col gap-3">
        {Array.from({ length: LEAGUE_CARDS }, (_, index) => (
          <SkeletonCard key={index} className="flex flex-col gap-3">
            <Skeleton className="h-7 w-2/3" />
            <div className="flex items-end justify-between">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-8 w-14" />
            </div>
            <div className="flex gap-3">
              {GP_ITEM_TYPES.map((itemType) => (
                <div key={itemType} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className={`${TEXT_XS_CLASS} w-3`} />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  )
}
