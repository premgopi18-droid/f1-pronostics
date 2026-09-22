import { Skeleton, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonChevronHeader, BUTTON_SM_CLASS } from '@/app/components/skeletons'

/** Avatar de prévisualisation du formulaire avatar. */
const PREVIEW_AVATAR_SIZE = 96
/** Casques esquissés dans le sélecteur. */
const HELMET_CHOICES = 8

// Skeleton du formulaire avatar — header, aperçu, grille de casques, bouton.
export default function EditAvatarLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonChevronHeader className="mb-6" />
      <div className="flex flex-col items-center gap-6">
        <SkeletonCircle size={PREVIEW_AVATAR_SIZE} />
        <div className="grid w-full grid-cols-4 gap-3">
          {Array.from({ length: HELMET_CHOICES }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className={BUTTON_SM_CLASS} />
      </div>
    </SkeletonPage>
  )
}
