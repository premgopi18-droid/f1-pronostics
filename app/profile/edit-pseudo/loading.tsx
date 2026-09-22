import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import {
  SkeletonChevronHeader,
  BUTTON_FORM_CLASS,
  INPUT_CLASS,
  TEXT_SM_CLASS,
} from '@/app/components/skeletons'

// Skeleton du formulaire pseudo — même silhouette que `EditPseudoForm` : header,
// label + champ, bouton d'enregistrement (largeur au contenu).
export default function EditPseudoLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col px-page pt-2 pb-6">
      <SkeletonChevronHeader className="mb-6" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className={`${TEXT_SM_CLASS} w-16`} />
          <Skeleton className={INPUT_CLASS} />
        </div>
        <Skeleton className={BUTTON_FORM_CLASS} />
      </div>
    </SkeletonPage>
  )
}
