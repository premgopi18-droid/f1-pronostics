import { Skeleton, SkeletonCard, SkeletonPage } from '@/app/ui/skeleton'
import {
  SkeletonRows,
  SkeletonSectionLabel,
  BUTTON_BLOCK_CLASS,
  CARD_SM_ONE_LINE_CLASS,
  CARD_SM_TWO_LINES_CLASS,
  TEXT_SM_CLASS,
} from '@/app/components/skeletons'

/** Lignes WDC / WCC de la section saison. */
const SEASON_ROWS = 2
/** Sessions du GP courant esquissées (qualifs + course). */
const GP_SESSION_ROWS = 2
/** GP passés esquissés dans l'historique. */
const HISTORY_ROWS = 3

// Skeleton de l'onglet Mes Pronos — saison (WDC, WCC, items), GP en cours, historique.
export default function PredictionsLoading() {
  return (
    <SkeletonPage className="flex flex-1 flex-col gap-6 px-page pb-6 pt-6">
      <Skeleton className="h-8 w-36" />

      <section className="flex flex-col gap-3">
        <SkeletonSectionLabel />
        <SkeletonRows count={SEASON_ROWS} rowClassName={CARD_SM_ONE_LINE_CLASS} className="gap-3" />
        <SkeletonCard>
          <SkeletonSectionLabel className="mb-3" />
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className={`${TEXT_SM_CLASS} w-32`} />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className={`${TEXT_SM_CLASS} w-36`} />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      </section>

      <section className="flex flex-col gap-3">
        <SkeletonSectionLabel />
        <SkeletonCard>
          <Skeleton className="h-7 w-3/4" />
          <div className="mt-3 flex flex-col">
            {Array.from({ length: GP_SESSION_ROWS }, (_, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-t border-border py-2.5 first:border-t-0"
              >
                <Skeleton className={`${TEXT_SM_CLASS} w-24`} />
                <Skeleton className="h-5 w-28 rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className={`${BUTTON_BLOCK_CLASS} mt-4`} />
        </SkeletonCard>
      </section>

      <section className="flex flex-col gap-3">
        <SkeletonSectionLabel />
        <SkeletonRows count={HISTORY_ROWS} rowClassName={CARD_SM_TWO_LINES_CLASS} />
      </section>
    </SkeletonPage>
  )
}
