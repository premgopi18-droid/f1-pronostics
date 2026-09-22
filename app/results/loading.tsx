import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonDividedList, SkeletonNextGpCard, SkeletonTabBar } from '@/app/components/skeletons'

/** Onglets Calendrier / Pilotes / Écuries. */
const RESULT_TABS = 3
/** GP esquissés dans le calendrier. */
const CALENDAR_ROWS = 6

// Skeleton de l'onglet Résultats — titre, onglets, card « prochain GP », calendrier.
export default function ResultsLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col pb-6 pt-6">
      <div className="px-page pb-4">
        <Skeleton className="h-8 w-44" />
      </div>
      <SkeletonTabBar tabs={RESULT_TABS} className="mx-page mb-4" />
      <div className="flex flex-1 flex-col gap-3 px-page">
        <SkeletonNextGpCard />
        <SkeletonDividedList count={CALENDAR_ROWS} rowClassName="py-3.5" />
      </div>
    </SkeletonPage>
  )
}
