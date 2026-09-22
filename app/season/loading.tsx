import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonRows, SkeletonTabBar, TEXT_SM_CLASS } from '@/app/components/skeletons'

/** Onglets WDC / WCC. */
const SEASON_TABS = 2
/** Positions esquissées (top 10 du classement). */
const STANDING_ROWS = 10

// Skeleton de la page pronos saison — header, onglets, liste des positions.
export default function SeasonLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col pb-6 pt-6">
      <div className="mb-5 flex flex-col gap-2 px-page">
        <Skeleton className={`${TEXT_SM_CLASS} w-24`} />
        <Skeleton className="h-8 w-56" />
        <Skeleton className={`${TEXT_SM_CLASS} w-64`} />
      </div>
      <SkeletonTabBar tabs={SEASON_TABS} className="mx-page mb-5" />
      <div className="px-page">
        <SkeletonRows count={STANDING_ROWS} rowClassName="h-11" />
      </div>
    </SkeletonPage>
  )
}
