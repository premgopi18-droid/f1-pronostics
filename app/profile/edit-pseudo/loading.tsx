import { Skeleton, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonChevronHeader, BUTTON_SM_CLASS } from '@/app/components/skeletons'

/** Avatar de prévisualisation du formulaire pseudo. */
const PREVIEW_AVATAR_SIZE = 96

// Skeleton du formulaire pseudo — header, aperçu avatar, champ, bouton.
export default function EditPseudoLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonChevronHeader className="mb-6" />
      <div className="flex flex-col items-center gap-6">
        <SkeletonCircle size={PREVIEW_AVATAR_SIZE} />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className={BUTTON_SM_CLASS} />
      </div>
    </SkeletonPage>
  )
}
