import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { BUTTON_BLOCK_CLASS, INPUT_LG_CLASS, TEXT_SM_CLASS, TEXT_XS_CLASS } from '@/app/components/skeletons'

/** Étapes du wizard (barre de progression). */
const WIZARD_STEPS = 2

// Skeleton de l'onboarding — silhouette de l'étape 1 de `OnboardingWizard` : barre de
// progression, libellé d'étape, titre, sous-titre, champ pseudo, bouton en bas. Évite
// que le skeleton de la Home (fallback racine) n'apparaisse sur un écran sans bottom nav.
export default function OnboardingLoading() {
  return (
    <SkeletonPage className="flex min-h-dvh flex-col px-page pb-6 pt-8">
      <div className="mb-8 flex flex-1 gap-1.5">
        {Array.from({ length: WIZARD_STEPS }, (_, index) => (
          <Skeleton key={index} className="h-1 flex-1 rounded-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <Skeleton className={`${TEXT_XS_CLASS} w-20`} />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className={`${TEXT_SM_CLASS} mt-2 w-72`} />
        <Skeleton className={`${INPUT_LG_CLASS} mt-8`} />
        <Skeleton className={`${TEXT_XS_CLASS} mt-2.5 w-24`} />
        <div className="flex-1" />
        <Skeleton className={BUTTON_BLOCK_CLASS} />
      </div>
    </SkeletonPage>
  )
}
