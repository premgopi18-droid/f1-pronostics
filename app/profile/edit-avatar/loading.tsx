import { Skeleton, SkeletonCircle, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonChevronHeader, BUTTON_FORM_CLASS } from '@/app/components/skeletons'
import { AVATAR_PREVIEW_SIZE } from '@/lib/profile/avatar-image'
import { HELMETS } from '@/lib/profile/avatars'

// Skeleton du formulaire avatar — silhouette de `EditAvatarForm` : header, aperçu photo
// (`AvatarPhotoField`) + ses deux boutons, grille de casques (`HelmetPicker`), bouton.
export default function EditAvatarLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonChevronHeader className="mb-6" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <SkeletonCircle size={AVATAR_PREVIEW_SIZE} />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3.5">
          {HELMETS.map((helmet) => (
            <Skeleton key={helmet.id} className="aspect-square w-full rounded-full" />
          ))}
        </div>
        <Skeleton className={BUTTON_FORM_CLASS} />
      </div>
    </SkeletonPage>
  )
}
