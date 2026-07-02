// Tracé SVG d'un circuit F1 — Server Component (aucun 'use client').
// Rendu 100 % SVG/CSS, sans librairie externe. L'animation de tracé (bx-draw) et le
// glow reposent sur des keyframes globales + `currentColor` (jamais de var(--x) dans
// un attribut SVG : Safari ne les résout pas → règle cross-browser du projet).

import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import {
  normalizeCoordinates,
  buildPathFromPoints,
  computeStartMarker,
  computeDirectionMarker,
  type GeoCoordinate,
} from '@/lib/f1/circuit-svg'
import { getLapsForCircuit, getTurnsForCircuit } from '@/lib/f1/circuit-static-data'

// ── Dimensions & style (aucune valeur magique) ──────────────────────────────
export const CIRCUIT_TRACK_VIEWBOX_WIDTH = 300
export const CIRCUIT_TRACK_VIEWBOX_HEIGHT = 200
export const CIRCUIT_TRACK_PADDING_PX = 24
const TRACK_STROKE_WIDTH = 2.5
const GLOW_STROKE_WIDTH = 5
const GLOW_BLUR_DEVIATION = 4
const DIRECTION_ARROW_FRACTION = 0.12
const DIRECTION_ARROW_SIZE = 9
const START_CHECKER_CELL_PX = 3.2
const START_CHECKER_COLUMNS = 2
const START_CHECKER_ROWS = 4
const METERS_PER_KILOMETER = 1000

/** Feature GeoJSON telle que stockée dans `circuit_tracks.geojson`. */
export interface CircuitFeature {
  geometry: { coordinates: GeoCoordinate[] }
  properties?: { length?: number | null }
}

interface CircuitTrackProps {
  geojson: CircuitFeature
  bacingerId: string
  circuitName: string
  className?: string
}

export function CircuitTrack({ geojson, bacingerId, circuitName, className }: CircuitTrackProps) {
  const coordinates = geojson?.geometry?.coordinates ?? []
  const points = normalizeCoordinates(
    coordinates,
    CIRCUIT_TRACK_VIEWBOX_WIDTH,
    CIRCUIT_TRACK_VIEWBOX_HEIGHT,
    CIRCUIT_TRACK_PADDING_PX,
  )

  // Tracé inexploitable (données absentes/dégénérées) → on n'affiche rien.
  if (points.length < 2) return null

  const path = buildPathFromPoints(points)
  const startMarker = computeStartMarker(points)
  const directionMarker = computeDirectionMarker(points, DIRECTION_ARROW_FRACTION)

  const lengthMeters = geojson.properties?.length ?? null
  const laps = getLapsForCircuit(bacingerId)
  const turns = getTurnsForCircuit(bacingerId)

  const stats: { label: string; value: string }[] = []
  if (lengthMeters != null && lengthMeters > 0) {
    const kilometers = (lengthMeters / METERS_PER_KILOMETER).toLocaleString('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
    stats.push({
      label: t('predict.circuit.lengthLabel'),
      value: `${kilometers} ${t('predict.circuit.lengthUnit')}`,
    })
  }
  if (laps != null) stats.push({ label: t('predict.circuit.lapsLabel'), value: String(laps) })
  if (turns != null) stats.push({ label: t('predict.circuit.turnsLabel'), value: String(turns) })

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-[linear-gradient(160deg,var(--surface-2),var(--card))] px-4 py-3',
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${CIRCUIT_TRACK_VIEWBOX_WIDTH} ${CIRCUIT_TRACK_VIEWBOX_HEIGHT}`}
        role="img"
        aria-label={t('predict.circuit.alt', { name: circuitName })}
        className="block w-full"
      >
        <defs>
          <filter id="circuit-track-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={GLOW_BLUR_DEVIATION} />
          </filter>
        </defs>

        {/* Lueur rouge derrière le tracé — currentColor = accent (text-primary) */}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={GLOW_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#circuit-track-glow)"
          className="text-primary opacity-60"
        />

        {/* Tracé principal — se dessine au chargement (respecte prefers-reduced-motion) */}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={TRACK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="text-foreground [stroke-dasharray:1] [animation:bx-draw_1.8s_ease-out] motion-reduce:[animation:none]"
        />

        {/* Damier de départ/arrivée — perpendiculaire au tracé, au 1ᵉʳ point */}
        {startMarker && (
          <g
            transform={`translate(${startMarker.x} ${startMarker.y}) rotate(${startMarker.angleDegrees})`}
            className="text-foreground"
          >
            {renderStartChecker()}
          </g>
        )}

        {/* Flèche de sens de parcours — orientée selon la tangente locale */}
        {directionMarker && (
          <path
            d={`M ${-DIRECTION_ARROW_SIZE / 2} ${-DIRECTION_ARROW_SIZE / 2} L ${DIRECTION_ARROW_SIZE / 2} 0 L ${-DIRECTION_ARROW_SIZE / 2} ${DIRECTION_ARROW_SIZE / 2} Z`}
            fill="currentColor"
            transform={`translate(${directionMarker.x} ${directionMarker.y}) rotate(${directionMarker.angleDegrees})`}
            className="text-primary"
          />
        )}
      </svg>

      {stats.length > 0 && (
        <dl className="mt-1 flex items-center justify-center gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
              <dt className="text-[0.65rem] uppercase tracking-wide text-text-muted">{stat.label}</dt>
              <dd className="font-display text-sm font-bold text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

// Damier : on ne peint QUE les cellules « blanches » (currentColor) ; les cellules
// « noires » sont laissées transparentes → le fond sombre de la carte fait le contraste.
// Bande centrée sur l'origine locale (le point de départ), épaisse le long du tracé (x),
// étalée en travers (y). Aucune couleur brute, une seule teinte.
function renderStartChecker() {
  const bandWidth = START_CHECKER_COLUMNS * START_CHECKER_CELL_PX
  const bandHeight = START_CHECKER_ROWS * START_CHECKER_CELL_PX
  const originX = -bandWidth / 2
  const originY = -bandHeight / 2

  const cells = []
  for (let row = 0; row < START_CHECKER_ROWS; row++) {
    for (let column = 0; column < START_CHECKER_COLUMNS; column++) {
      if ((row + column) % 2 !== 0) continue
      cells.push(
        <rect
          key={`${row}-${column}`}
          x={originX + column * START_CHECKER_CELL_PX}
          y={originY + row * START_CHECKER_CELL_PX}
          width={START_CHECKER_CELL_PX}
          height={START_CHECKER_CELL_PX}
          fill="currentColor"
        />,
      )
    }
  }
  return cells
}
