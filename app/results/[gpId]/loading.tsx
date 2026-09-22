import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonDividedList, SkeletonTabBar } from '@/app/components/skeletons'

/** Onglets officiels Course / Qualifs. */
const OFFICIAL_TABS = 2
/** Pilotes esquissés (lignes visibles avant scroll). */
const RESULT_ROWS = 10

// Skeleton de la page résultats d'un GP — header, onglets, classement.
export default function GpResultsLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col pb-6">
      <div className="flex items-center gap-2 px-page py-4">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-7 w-44" />
      </div>
      <div className="flex flex-1 flex-col gap-4 px-page">
        <SkeletonTabBar tabs={OFFICIAL_TABS} />
        <SkeletonDividedList count={RESULT_ROWS} rowClassName="py-3" />
      </div>
    </SkeletonPage>
  )
}
