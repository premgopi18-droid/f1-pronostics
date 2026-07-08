import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { getCachedDrivers, getCachedConstructors } from '@/lib/f1/cached'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import { t } from '@/lib/i18n'
import { PredictionTabs, type SessionData } from './prediction-tabs'
import type { Driver } from './prediction-form'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'
import { getBacingerId } from '@/lib/f1/circuit-mapping'
import { getTurnsForCircuit } from '@/lib/f1/circuit-static-data'
import { CircuitTrack, type CircuitFeature } from '@/app/ui/circuit-track'

export default async function PredictPage({
  params,
}: {
  params: Promise<{ gpId: string }>
}) {
  const { gpId }   = await params
  const supabase   = await createClient()
  const season     = getCurrentSeason()
  const userId     = (await headers()).get('x-user-id')!

  const [{ data: gp }, { data: sessions }, driversRaw, constructorsRaw] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round, circuit')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, starts_at')
      .eq('gp_id', gpId)
      .eq('season', season)
      // Essais libres exclus : seules les sessions scorées sont pronosticables.
      .in('type', SCOREABLE_SESSION_TYPES)
      .order('starts_at'),
    getCachedDrivers(season),
    getCachedConstructors(season),
  ])

  if (!gp) notFound()

  // Tracé du circuit (optionnel) : lookup nom Jolpica → id bacinger, puis lecture publique
  // de `circuit_tracks`. Tout échec de mapping/lecture → pas de tracé (fallback gracieux).
  // Tours : dérivés de la dernière édition disputée du circuit (`race_laps`, #174) —
  // toujours à jour, se remplit tout seul après la 1ʳᵉ course d'un nouveau circuit.
  const bacingerId = getBacingerId(gp.circuit)
  let circuitFeature: CircuitFeature | null = null
  let circuitLaps: number | null = null
  if (bacingerId) {
    const [{ data: track }, { data: lapsRow }] = await Promise.all([
      supabase.from('circuit_tracks').select('geojson').eq('id', bacingerId).single(),
      supabase
        .from('grands_prix')
        .select('race_laps')
        .eq('circuit', gp.circuit)
        .not('race_laps', 'is', null)
        .order('season', { ascending: false })
        .order('round', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    circuitFeature = (track?.geojson as CircuitFeature | undefined) ?? null
    circuitLaps = lapsRow?.race_laps ?? null
  }
  const circuitTurns = bacingerId ? getTurnsForCircuit(bacingerId) : null

  const constructorByCode = new Map(
    constructorsRaw.map((c) => [c.id, { code: c.code, name: c.name }]),
  )

  const drivers: Driver[] = driversRaw.map((d) => {
    const constructor = constructorByCode.get(d.constructor_id ?? '') ?? { code: '', name: '' }
    return {
      id:        d.id,
      code:      d.code,
      firstName: d.first_name,
      lastName:  d.last_name,
      // Divergence schéma ↔ hypothèse : `number` est nullable en DB, mais toujours
      // renseigné par le sync Jolpica (numéro permanent des pilotes).
      number:    d.number as number,
      teamCode:  constructor.code,
      teamName:  constructor.name,
    }
  })

  const sessionIds = (sessions ?? []).map((s) => s.id)

  let predictionsBySession  = new Map<string, string[]>()
  let fastestLapBySession   = new Map<string, string | null>()

  if (sessionIds.length > 0) {
    const [{ data: predictions }, { data: fastestLapRows }] = await Promise.all([
      supabase
        .from('predictions')
        .select('session_id, entries')
        .eq('user_id', userId)
        .in('session_id', sessionIds),
      supabase
        .from('fastest_lap_predictions')
        .select('session_id, drivers!driver_id(code)')
        .eq('user_id', userId)
        .in('session_id', sessionIds),
    ])

    predictionsBySession = new Map(
      (predictions ?? []).map((p) => [p.session_id, p.entries as string[]]),
    )
    fastestLapBySession = new Map(
      (fastestLapRows ?? []).map((p) => {
        const driver = p.drivers
        return [p.session_id, driver?.code ?? null]
      }),
    )
  }

  const now = new Date()

  const sessionList: SessionData[] = (sessions ?? []).map((s) => {
    const type = s.type as SessionType
    return {
      id:                 s.id,
      type,
      startsAt:           s.starts_at,
      expectedCount:      POSITIONS_TO_SCORE[type],
      existingEntries:    predictionsBySession.get(s.id) ?? [],
      existingFastestLap: fastestLapBySession.get(s.id) ?? null,
      isLocked:           new Date(s.starts_at) <= now,
    }
  })

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto flex max-w-sm flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-foreground"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {t('predict.back')}
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {gp.name}
          </h1>
          <p className="text-sm text-text-secondary">
            {gp.country} · {t('home.round')} {gp.round} · {season}
          </p>
        </div>

        {/* Tracé du circuit (si cartographié et présent en base) */}
        {circuitFeature && bacingerId && (
          <CircuitTrack
            geojson={circuitFeature}
            bacingerId={bacingerId}
            circuitName={gp.circuit}
            laps={circuitLaps}
            turns={circuitTurns}
          />
        )}

        {/* Tabs + forms */}
        <PredictionTabs sessions={sessionList} drivers={drivers} />

      </div>
    </main>
  )
}
