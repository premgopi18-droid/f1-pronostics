import { Skeleton, SkeletonCard, SkeletonPage } from '@/app/ui/skeleton'
import {
  SkeletonBackHeader,
  SkeletonDividedList,
  SkeletonSectionLabel,
  BUTTON_SM_CLASS,
  TEXT_SM_CLASS,
} from '@/app/components/skeletons'

/** Membres esquissés dans la liste d'administration. */
const MEMBER_ROWS = 4

// Skeleton de la page admin d'une ligue — header, card invitation, liste des membres.
export default function LeagueAdminLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonBackHeader />
      <div className="mt-2 flex flex-col gap-6">
        <SkeletonCard className="flex flex-col gap-3">
          <SkeletonSectionLabel />
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex items-center justify-between">
            <Skeleton className={`${TEXT_SM_CLASS} w-40`} />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
          <Skeleton className={BUTTON_SM_CLASS} />
        </SkeletonCard>
        <section>
          <SkeletonSectionLabel className="mb-3" />
          <SkeletonDividedList count={MEMBER_ROWS} rowClassName="py-3" />
        </section>
      </div>
    </SkeletonPage>
  )
}
