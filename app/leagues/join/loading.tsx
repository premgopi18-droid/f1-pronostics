import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { BUTTON_BLOCK_CLASS, TEXT_SM_CLASS } from '@/app/components/skeletons'

// Skeleton de la page « rejoindre une ligue » — retour, titre, champ code, bouton.
export default function JoinLoading() {
  return (
    <SkeletonPage className="flex min-h-dvh flex-col px-page pb-6 pt-8">
      <Skeleton className={`${TEXT_SM_CLASS} mb-6 w-20`} />
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 flex flex-col gap-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className={BUTTON_BLOCK_CLASS} />
      </div>
    </SkeletonPage>
  )
}
