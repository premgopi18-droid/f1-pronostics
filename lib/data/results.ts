import { createClient } from '@/lib/supabase'
import { getCountryCode } from '@/lib/f1/country-codes'
import { getCountryNameFr, getGpNameFr } from '@/lib/f1/country-names-fr'
import { computeGpStatuses, type GpStatus } from '@/lib/results/calendar'

// ── Types ────────────────────────────────────────────────────────────────────

export type CalendarGp = {
  id: string
  round: number
  countryCode: string
  displayName: string
  gpName: string
  status: GpStatus
  /** Nom de famille du vainqueur de course, null si pas encore finalisé. */
  winner: string | null
  qualifyingStartsAt: string | null
  raceStartsAt: string | null
}

export type GpResultRow = {
  position: number | null
  dnf: boolean
  fastestLap: boolean
  driverCode: string
  firstName: string
  lastName: string
  constructorName: string
  constructorCode: string
}

export type GpDetailData = {
  id: string
  gpName: string
  countryCode: string
  round: number
  race: GpResultRow[]
  qualifying: GpResultRow[]
}

// ── Calendrier saison ────────────────────────────────────────────────────────

export async function getSeasonCalendar(season: number): Promise<CalendarGp[]> {
  const supabase = await createClient()
  const nowMs = Date.now()

  const [{ data: gps, error: gpsError }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, round, country')
      .eq('season', season)
      .eq('is_cancelled', false)
      .order('round', { ascending: true }),
    supabase
      .from('sessions')
      .select('id, gp_id, type, starts_at, results_confirmed_at')
      .eq('season', season)
      .in('type', ['race', 'qualifying']),
  ])

  if (gpsError) throw gpsError

  const gpList = gps ?? []
  const sessions = sessionRows ?? []

  // Maps gpId → { raceStartsAt, qualifyingStartsAt, raceResultsConfirmedAt } et raceSessionId → gpId
  const sessionMap = new Map<
    string,
    { raceStartsAt?: string; qualifyingStartsAt?: string; raceResultsConfirmedAt?: string | null }
  >()
  const raceSessionToGp = new Map<string, string>()

  for (const s of sessions) {
    const gpId = s.gp_id as string
    const entry = sessionMap.get(gpId) ?? {}
    if (s.type === 'race') {
      entry.raceStartsAt = s.starts_at as string
      entry.raceResultsConfirmedAt = s.results_confirmed_at as string | null
      raceSessionToGp.set(s.id as string, gpId)
    }
    if (s.type === 'qualifying') {
      entry.qualifyingStartsAt = s.starts_at as string
    }
    sessionMap.set(gpId, entry)
  }

  // Vainqueurs des courses confirmées (1 requête batch)
  const raceSessionIds = Array.from(raceSessionToGp.keys())
  const { data: winnerRows } = raceSessionIds.length
    ? await supabase
        .from('session_results')
        .select('session_id, drivers!driver_id(last_name)')
        .in('session_id', raceSessionIds)
        .eq('position', 1)
    : { data: [] }

  const winnerMap = new Map<string, string>()
  for (const row of winnerRows ?? []) {
    const gpId = raceSessionToGp.get(row.session_id as string)
    const driver = (row.drivers as unknown as { last_name: string } | null)
    if (gpId && driver) winnerMap.set(gpId, driver.last_name)
  }

  const forStatus = gpList.map((gp) => ({
    raceResultsConfirmedAt: sessionMap.get(gp.id as string)?.raceResultsConfirmedAt ?? null,
    qualifyingStartsAt: sessionMap.get(gp.id as string)?.qualifyingStartsAt ?? null,
  }))

  const statuses = computeGpStatuses(forStatus, nowMs)

  return gpList.map((gp, i) => {
    const gpId = gp.id as string
    const country = gp.country as string
    const gpSessions = sessionMap.get(gpId) ?? {}
    return {
      id: gpId,
      round: gp.round as number,
      countryCode: getCountryCode(country),
      displayName: getCountryNameFr(country),
      gpName: getGpNameFr(country),
      status: statuses[i],
      winner: winnerMap.get(gpId) ?? null,
      qualifyingStartsAt: gpSessions.qualifyingStartsAt ?? null,
      raceStartsAt: gpSessions.raceStartsAt ?? null,
    }
  })
}

// ── Détail d'un GP ───────────────────────────────────────────────────────────

export async function getGpDetail(gpId: string): Promise<GpDetailData | null> {
  const supabase = await createClient()

  const [{ data: gp }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, round, country')
      .eq('id', gpId)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('id, type')
      .eq('gp_id', gpId)
      .in('type', ['race', 'qualifying']),
  ])

  if (!gp) return null

  const sessions = sessionRows ?? []
  const sessionIds = sessions.map((s) => s.id as string)
  const sessionTypeMap = new Map(sessions.map((s) => [s.id as string, s.type as string]))

  if (sessionIds.length === 0) {
    return {
      id: gpId,
      gpName: getGpNameFr(gp.country as string),
      countryCode: getCountryCode(gp.country as string),
      round: gp.round as number,
      race: [],
      qualifying: [],
    }
  }

  const { data: resultRows } = await supabase
    .from('session_results')
    .select(
      'session_id, position, dnf, fastest_lap, drivers!driver_id(code, first_name, last_name, constructors!constructor_id(name, code))',
    )
    .in('session_id', sessionIds)

  type DriverEmbed = {
    code: string
    first_name: string
    last_name: string
    constructors: { name: string; code: string } | null
  }

  const race: GpResultRow[] = []
  const qualifying: GpResultRow[] = []

  for (const row of resultRows ?? []) {
    const driver = (row.drivers as unknown as DriverEmbed | null)
    if (!driver) continue

    const result: GpResultRow = {
      position: row.position as number | null,
      dnf: row.dnf as boolean,
      fastestLap: row.fastest_lap as boolean,
      driverCode: driver.code,
      firstName: driver.first_name,
      lastName: driver.last_name,
      constructorName: driver.constructors?.name ?? '',
      constructorCode: driver.constructors?.code ?? '',
    }

    const sessionType = sessionTypeMap.get(row.session_id as string)
    if (sessionType === 'race') race.push(result)
    else if (sessionType === 'qualifying') qualifying.push(result)
  }

  const sortByPosition = (rows: GpResultRow[]) =>
    rows.sort((a, b) => {
      if (a.position === null && b.position === null) return 0
      if (a.position === null) return 1
      if (b.position === null) return -1
      return a.position - b.position
    })

  return {
    id: gpId,
    gpName: getGpNameFr(gp.country as string),
    countryCode: getCountryCode(gp.country as string),
    round: gp.round as number,
    race: sortByPosition(race),
    qualifying: sortByPosition(qualifying),
  }
}
