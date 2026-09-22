import { Skeleton, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import {
  SkeletonPodium,
  SkeletonRows,
  SkeletonSectionLabel,
  TEXT_SM_CLASS,
} from '@/app/components/skeletons'

/** Cercle pilote du podium du recap (`w-12 h-12`). */
const PODIUM_DRIVER_SIZE = 48
/** Marches du podium. */
const PODIUM_SIZE = 3
/** Lignes de détail par session esquissées. */
const DETAIL_ROWS = 4

// Skeleton du recap GP — header, podium officiel, détail par session.
export default function RecapLoading() {
  return (
    <SkeletonPage className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className={`${TEXT_SM_CLASS} w-24`} />
          <SkeletonSectionLabel className="w-32" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className={`${TEXT_SM_CLASS} w-3/4`} />
        </div>

        <section className="flex flex-col gap-3">
          <SkeletonSectionLabel />
          <div className="flex justify-center gap-4">
            {Array.from({ length: PODIUM_SIZE }, (_, index) => (
              <SkeletonCircle key={index} size={PODIUM_DRIVER_SIZE} />
            ))}
          </div>
          <SkeletonPodium />
        </section>

        <section className="flex flex-col gap-3">
          <SkeletonSectionLabel />
          <SkeletonRows count={DETAIL_ROWS} rowClassName="h-12" />
        </section>
      </div>
    </SkeletonPage>
  )
}
