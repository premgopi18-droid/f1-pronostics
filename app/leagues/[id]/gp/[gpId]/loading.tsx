import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonRows, SkeletonSectionLabel, TEXT_SM_CLASS } from '@/app/components/skeletons'

/** Membres esquissés au classement du GP. */
const MEMBER_ROWS = 4
/** Faits marquants (items joués) esquissés. */
const FACT_ROWS = 2

// Skeleton des pages GP d'une ligue (scores, compare, items) — même gabarit
// `max-w-lg` / `px-4 py-8` : retour, titre, sous-titre, puis sections en liste.
export default function LeagueGpLoading() {
  return (
    <SkeletonPage className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className={`${TEXT_SM_CLASS} w-24`} />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>

        <section className="flex flex-col gap-3">
          <SkeletonSectionLabel />
          <SkeletonRows count={MEMBER_ROWS} rowClassName="h-12" className="gap-1" />
        </section>

        <section className="flex flex-col gap-2.5">
          <SkeletonSectionLabel />
          <SkeletonRows count={FACT_ROWS} rowClassName="h-16" className="gap-2.5" />
        </section>
      </div>
    </SkeletonPage>
  )
}
