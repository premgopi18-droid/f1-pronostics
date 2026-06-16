import 'server-only'
import {
  fetchCalendar,
  fetchConstructors,
  fetchDriverConstructorLinks,
  fetchDrivers,
  fetchQualifyingResults,
  fetchRaceResults,
  fetchSprintRaceResults,
} from '@/lib/f1/jolpica'
import { fetchSprintQualifyingResults } from '@/lib/f1/openf1'
import {
  confirmSessionResults,
  upsertConstructors,
  upsertDriverConstructorLinks,
  upsertDrivers,
  upsertGrandsPrix,
  upsertSessions,
} from '@/lib/data/f1-sync'
import { upsertSessionResults } from '@/lib/data/session-results'
import { createServiceClient } from '@/lib/supabase'
import type { DriverResult, SessionType } from '@/lib/scoring/types'

const CURRENT_SEASON = 2025

function isAuthorized(request: Request): boolean {
  return request.headers.get('x-cron-secret') === process.env.CRON_SECRET
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── Phase 1 : récupération des données F1 (tout en parallèle) ──────────
    const [calendar, drivers, constructors, links] = await Promise.all([
      fetchCalendar(CURRENT_SEASON),
      fetchDrivers(CURRENT_SEASON),
      fetchConstructors(CURRENT_SEASON),
      fetchDriverConstructorLinks(CURRENT_SEASON),
    ])

    // ── Phase 2 : sync base de données ─────────────────────────────────────
    await upsertConstructors(constructors)
    await upsertDrivers(drivers)
    await upsertDriverConstructorLinks(CURRENT_SEASON, links)

    const gpRoundToId = await upsertGrandsPrix(calendar)

    // Map round → circuitShortName pour le fetch OpenF1 sprint qualifying plus bas
    const roundToCircuit = new Map(calendar.map((e) => [e.round, e.circuitShortName]))

    for (const entry of calendar) {
      const gpId = gpRoundToId.get(entry.round)
      if (!gpId) continue

      const sessions: { type: SessionType; startsAt: string }[] = [
        { type: 'qualifying', startsAt: entry.qualifyingStartsAt },
        { type: 'race',       startsAt: entry.raceStartsAt },
      ]
      if (entry.isSprintWeekend) {
        if (entry.sprintQualStartsAt) sessions.push({ type: 'sprint_qualifying', startsAt: entry.sprintQualStartsAt })
        if (entry.sprintRaceStartsAt) sessions.push({ type: 'sprint_race',       startsAt: entry.sprintRaceStartsAt })
      }
      await upsertSessions(gpId, CURRENT_SEASON, sessions)
    }

    // ── Phase 3 : confirmation des sessions passées non encore confirmées ───
    const now = new Date().toISOString()
    const supabase = createServiceClient()
    const { data: pending, error: pendingError } = await supabase
      .from('sessions')
      .select('id, type, season, grands_prix!gp_id(round)')
      .is('results_confirmed_at', null)
      .lt('starts_at', now)

    if (pendingError) throw pendingError

    let sessionsConfirmed = 0

    for (const row of pending ?? []) {
      const gp = (row.grands_prix as unknown) as { round: number } | null
      if (!gp) continue

      const sessionType = row.type as SessionType
      const season      = row.season as number
      const round       = gp.round

      let results: Map<string, DriverResult>

      if (sessionType === 'race') {
        results = await fetchRaceResults(season, round)
      } else if (sessionType === 'qualifying') {
        results = await fetchQualifyingResults(season, round)
      } else if (sessionType === 'sprint_race') {
        results = await fetchSprintRaceResults(season, round)
      } else if (sessionType === 'sprint_qualifying') {
        const circuitShortName = roundToCircuit.get(round)
        if (!circuitShortName) continue
        results = await fetchSprintQualifyingResults(season, circuitShortName)
      } else {
        continue
      }

      // Résultats pas encore disponibles (course non terminée)
      if (results.size === 0) continue

      await upsertSessionResults(row.id as string, season, results)
      await confirmSessionResults(row.id as string)
      sessionsConfirmed++
    }

    return Response.json({ gps: calendar.length, sessionsConfirmed })
  } catch (error) {
    console.error('[api/f1/sync]', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
