import { Skeleton, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import { BUTTON_BLOCK_CLASS, TEXT_SM_CLASS } from '@/app/components/skeletons'

/** Avatar de prévisualisation de l'onboarding. */
const PREVIEW_AVATAR_SIZE = 96

// Skeleton de l'onboarding — étape, titre, aperçu avatar, champ, bouton. Évite que le
// skeleton de la Home (fallback racine) n'apparaisse sur un écran sans bottom nav.
export default function OnboardingLoading() {
  return (
    <SkeletonPage className="flex min-h-dvh flex-col px-page pb-6 pt-8">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className={`${TEXT_SM_CLASS} mt-2 w-72`} />
      <div className="mt-8 flex flex-col items-center gap-6">
        <SkeletonCircle size={PREVIEW_AVATAR_SIZE} />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="mt-auto pt-6">
        <Skeleton className={BUTTON_BLOCK_CLASS} />
      </div>
    </SkeletonPage>
  )
}
