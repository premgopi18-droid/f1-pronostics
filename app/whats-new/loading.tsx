import { SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonChevronHeader, SkeletonRows } from '@/app/components/skeletons'

/** Annonces esquissées. */
const ANNOUNCEMENT_ROWS = 3

// Skeleton de la page Nouveautés — header, liste d'annonces.
export default function WhatsNewLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonChevronHeader className="mb-2" />
      <SkeletonRows count={ANNOUNCEMENT_ROWS} rowClassName="h-24 rounded-2xl" className="mt-2 gap-3" />
    </SkeletonPage>
  )
}
