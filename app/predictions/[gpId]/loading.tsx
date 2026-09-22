import { Skeleton, SkeletonPage } from '@/app/ui/skeleton'
import { SkeletonRows, SkeletonTabBar, TEXT_SM_CLASS } from '@/app/components/skeletons'
import { CIRCUIT_TRACK_VIEWBOX_WIDTH, CIRCUIT_TRACK_VIEWBOX_HEIGHT } from '@/app/ui/circuit-track'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'

/** Onglets de sessions (qualifs + course hors week-end sprint). */
const SESSION_TABS = 2

// Skeleton de la page pronostic d'un GP — header, tracé du circuit, onglets, liste des positions.
export default function PredictGpLoading() {
  return (
    <SkeletonPage className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className={`${TEXT_SM_CLASS} w-20`} />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className={`${TEXT_SM_CLASS} w-1/2`} />
        </div>

        {/* Tracé du circuit : même ratio que le viewBox de `CircuitTrack`. */}
        <Skeleton
          className="w-full rounded-2xl"
          style={{ aspectRatio: `${CIRCUIT_TRACK_VIEWBOX_WIDTH} / ${CIRCUIT_TRACK_VIEWBOX_HEIGHT}` }}
        />

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className={`${TEXT_SM_CLASS} w-10`} />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <SkeletonTabBar tabs={SESSION_TABS} />
          {/* Onglet ouvert par défaut = première session non verrouillée, en général
              les qualifs → leur nombre de positions, pas celui de la course. */}
          <SkeletonRows count={POSITIONS_TO_SCORE.qualifying} rowClassName="h-12" />
        </div>
      </div>
    </SkeletonPage>
  )
}
