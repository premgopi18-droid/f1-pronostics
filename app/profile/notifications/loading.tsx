import { SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonChevronHeader, SkeletonDividedList } from '@/app/components/skeletons'

/** Réglages de notifications esquissés. */
const SETTING_ROWS = 4

// Skeleton des réglages de notifications — header, liste de réglages.
export default function NotificationsLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonChevronHeader className="mb-2" />
      <SkeletonDividedList count={SETTING_ROWS} className="mt-4" />
    </SkeletonPage>
  )
}
