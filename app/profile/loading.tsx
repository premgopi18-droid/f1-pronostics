import { Skeleton, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonDividedList, TEXT_SM_CLASS } from '@/app/components/skeletons'

/** Avatar du header profil (`UserAvatar size={80}`). */
const PROFILE_AVATAR_SIZE = 80
/** Lignes de réglages (`ProfileSettings`). */
const SETTINGS_ROWS = 6

// Skeleton de l'onglet Profil — avatar + stats, réglages, déconnexion.
export default function ProfileLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pb-6 pt-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <SkeletonCircle size={PROFILE_AVATAR_SIZE} />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className={`${TEXT_SM_CLASS} w-40`} />
        </div>
      </div>
      <SkeletonDividedList count={SETTINGS_ROWS} />
      <Skeleton className="mt-6 h-12 w-full rounded-2xl" />
    </SkeletonPage>
  )
}
