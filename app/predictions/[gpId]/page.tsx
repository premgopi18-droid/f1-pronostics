import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { getCachedDrivers, getCachedConstructors, getCachedLatestRaceConstructorCodes } from '@/lib/f1/cached'
import { constructorCodeFromOpenF1TeamName } from '@/lib/f1/team-names'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import { t } from '@/lib/i18n'
import { PredictionTabs, type SessionData } from './prediction-tabs'
import type { Driver } from './prediction-form'
import { getStartingGrids } from '@/lib/data/starting-grids'
import { GRID_SOURCE_SESSION_TYPE, gridSourceSessionType } from '@/lib/f1/grid'
import type { GridSource } from '@/lib/predictions/helpers'
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

  const [{ data: gp }, { data: sessions }, driversRaw, constructorsRaw, latestRaceConstructorCodes] = await Promise.all([
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
    getCachedLatestRaceConstructorCodes(season),
  ])

  if (!gp) notFound()

  // Vague 2 (#183) — tout ce qui dépend de la vague 1 part en parallèle :
  // tracé du circuit + tours (dépendent de gp.circuit) et pronos + meilleur tour
  // de l'utilisateur (dépendent des sessions).
  //
  // Tracé du circuit (optionnel) : lookup nom Jolpica → id bacinger, puis lecture publique
  // de `circuit_tracks`. Tout échec de mapping/lecture → pas de tracé (fallback gracieux).
  // Tours : dérivés de la dernière édition disputée du circuit (`race_laps`, #174) —
  // toujours à jour, se remplit tout seul après la 1ʳᵉ course d'un nouveau circuit.
  const bacingerId = getBacingerId(gp.circuit)
  const sessionIds = (sessions ?? []).map((s) => s.id)

  // Pré-remplissage grille (#201) : sessions course non verrouillées, et
  // sessions source (qualifs / sprint qualifs) dont le classement sert de
  // fallback tant que la grille officielle n'est pas en base.
  const now = new Date()
  const openRaceSessionIds = (sessions ?? [])
    .filter((s) => gridSourceSessionType(s.type as SessionType) && new Date(s.starts_at) > now)
    .map((s) => s.id)
  const fallbackSourceIds = (sessions ?? [])
    .filter((s) => Object.values(GRID_SOURCE_SESSION_TYPE).includes(s.type as SessionType))
    .map((s) => s.id)

  const [
    { data: track },
    { data: lapsRow },
    { data: predictions },
    { data: fastestLapRows },
    startingGrids,
    { data: fallbackResultRows },
    { data: observedLineupRows },
  ] = await Promise.all([
    bacingerId
      ? supabase.from('circuit_tracks').select('geojson').eq('id', bacingerId).single()
      : { data: null },
    bacingerId
      ? supabase
          .from('grands_prix')
          .select('race_laps')
          .eq('circuit', gp.circuit)
          .not('race_laps', 'is', null)
          .order('season', { ascending: false })
          .order('round', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null },
    sessionIds.length > 0
      ? supabase
          .from('predictions')
          .select('session_id, entries')
          .eq('user_id', userId)
          .in('session_id', sessionIds)
      : { data: [] },
    sessionIds.length > 0
      ? supabase
          .from('fastest_lap_predictions')
          .select('session_id, drivers!driver_id(code)')
          .eq('user_id', userId)
          .in('session_id', sessionIds)
      : { data: [] },
    getStartingGrids(openRaceSessionIds),
    openRaceSessionIds.length > 0 && fallbackSourceIds.length > 0
      ? supabase
          .from('session_results')
          .select('session_id, position, drivers!driver_id(code)')
          .in('session_id', fallbackSourceIds)
          .not('position', 'is', null)
          .order('position', { ascending: true })
      : { data: [] },
    // Line-up observé du week-end (#211) : pilotes réellement vus en piste sur
    // une session fiable de CE GP, avec leur écurie du moment (libellé OpenF1).
    supabase
      .from('gp_lineups')
      .select('team_name, drivers!driver_id(code)')
      .eq('gp_id', gpId)
      .not('observed_at', 'is', null),
  ])

  const circuitFeature = (track?.geojson as CircuitFeature | undefined) ?? null
  const circuitLaps    = lapsRow?.race_laps ?? null
  const circuitTurns   = bacingerId ? getTurnsForCircuit(bacingerId) : null

  const constructorById = new Map(
    constructorsRaw.map((c) => [c.id, { code: c.code, name: c.name }]),
  )
  const constructorNameByCode = new Map(
    constructorsRaw.map((c) => [c.code, c.name]),
  )

  // Line-up observé du week-end (#211) : code pilote → libellé écurie OpenF1.
  // Vide tant qu'aucune session fiable du GP n'a été observée (jeudi, vendredi
  // matin) — dans ce cas, ni écurie week-end ni signal d'absence.
  const observedTeamNameByCode = new Map<string, string>()
  for (const row of observedLineupRows ?? []) {
    if (row.drivers) observedTeamNameByCode.set(row.drivers.code, row.team_name)
  }
  const hasWeekendObservation = observedTeamNameByCode.size > 0

  // Écurie affichée = line-up observé du week-end (#211, gère l'échange de
  // baquet AVANT la course) > dernière course disputée (#205) > mapping saison.
  // Un pilote de la saison jamais observé alors que d'autres l'ont été est
  // signalé « absent du week-end ? » et relégué en fin de liste — jamais bloqué.
  const drivers: Driver[] = driversRaw.map((d) => {
    const seasonConstructor = constructorById.get(d.constructor_id ?? '') ?? { code: '', name: '' }
    const observedTeamName  = observedTeamNameByCode.get(d.code)
    const weekendCode       = observedTeamName ? constructorCodeFromOpenF1TeamName(observedTeamName) : null
    const teamCode          = weekendCode ?? latestRaceConstructorCodes[d.code] ?? seasonConstructor.code
    return {
      id:                d.id,
      code:              d.code,
      firstName:         d.first_name,
      lastName:          d.last_name,
      number:            d.number,
      teamCode,
      teamName:          constructorNameByCode.get(teamCode) ?? seasonConstructor.name,
      absentFromWeekend: hasWeekendObservation && !observedTeamNameByCode.has(d.code),
    }
  })
  // Tri stable : ordre par code préservé au sein de chaque groupe.
  drivers.sort((a, b) => Number(a.absentFromWeekend) - Number(b.absentFromWeekend))

  const predictionsBySession = new Map(
    (predictions ?? []).map((p) => [p.session_id, p.entries as string[]]),
  )
  const fastestLapBySession = new Map(
    (fastestLapRows ?? []).map((p) => [p.session_id, p.drivers?.code ?? null]),
  )

  // Classement fallback par session source : codes pilotes ordonnés par position.
  const fallbackOrderBySourceId = new Map<string, string[]>()
  for (const row of fallbackResultRows ?? []) {
    if (!row.drivers) continue
    const codes = fallbackOrderBySourceId.get(row.session_id) ?? []
    codes.push(row.drivers.code)
    fallbackOrderBySourceId.set(row.session_id, codes)
  }
  const sessionIdByType = new Map((sessions ?? []).map((s) => [s.type as SessionType, s.id]))

  const sessionList: SessionData[] = (sessions ?? []).map((s) => {
    const type = s.type as SessionType

    // Ordre de grille proposé pour les sessions course encore ouvertes :
    // grille officielle en priorité, classement de la session source sinon.
    const sourceType = gridSourceSessionType(type)
    let gridOrder: string[] = []
    let gridSource: GridSource | null = null
    if (sourceType && openRaceSessionIds.includes(s.id)) {
      const officialGrid  = startingGrids.get(s.id)
      const fallbackOrder = fallbackOrderBySourceId.get(sessionIdByType.get(sourceType) ?? '')
      if (officialGrid && officialGrid.length > 0) {
        gridOrder  = officialGrid
        gridSource = 'grid'
      } else if (fallbackOrder && fallbackOrder.length > 0) {
        gridOrder  = fallbackOrder
        gridSource = 'qualifying'
      }
    }

    return {
      id:                 s.id,
      type,
      startsAt:           s.starts_at,
      expectedCount:      POSITIONS_TO_SCORE[type],
      existingEntries:    predictionsBySession.get(s.id) ?? [],
      existingFastestLap: fastestLapBySession.get(s.id) ?? null,
      isLocked:           new Date(s.starts_at) <= now,
      gridOrder,
      gridSource,
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
