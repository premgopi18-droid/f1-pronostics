import type { DriverResult } from '@/lib/scoring/types'

const BASE_URL = 'https://api.jolpi.ca/ergast/f1'

// ============================================================
// Types internes — structure de réponse Jolpica (subset utile)
// ============================================================

interface JolpikaDriver {
  code:       string   // "VER", "NOR"
  driverId:   string   // "verstappen"
  givenName:  string
  familyName: string
  permanentNumber: string
}

interface JolpikaConstructor {
  constructorId: string  // "red_bull"
  name:          string
}

interface JolpikaRaceResult {
  position:     string
  positionText: string   // "1".."20", "R"=Retired, "D"=DSQ, "N"=non-classé
  Driver:       JolpikaDriver
  FastestLap?:  { rank: string }
}

interface JolpikaQualifyingResult {
  position: string
  Driver:   JolpikaDriver
}

interface JolpikaRace {
  season:    string
  round:     string
  raceName:  string
  Circuit: {
    circuitName: string
    Location: { country: string; locality: string }
  }
  date:   string   // race date YYYY-MM-DD
  time?:  string   // race time HH:MM:SSZ
  FirstPractice?: { date: string; time: string }
  Sprint?: { date: string; time: string }         // existe si sprint weekend
  Results?:            JolpikaRaceResult[]
  QualifyingResults?:  JolpikaQualifyingResult[]
  SprintResults?:      JolpikaRaceResult[]
}

// Shapes renvoyés par les fonctions de sync (→ lib/data/)
export interface CalendarEntry {
  season:            number
  round:             number
  name:              string
  circuit:           string
  country:           string
  isSprintWeekend:   boolean
  weekendStartsAt:   string   // ISO 8601
}

export interface DriverEntry {
  season:    number
  code:      string
  firstName: string
  lastName:  string
  number:    number
}

export interface ConstructorEntry {
  season:        number
  code:          string
  constructorId: string
  name:          string
}

export interface DriverConstructorLink {
  driverCode:      string
  constructorCode: string
}

// ============================================================
// Helper HTTP
// ============================================================

async function jolpikaGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}.json`, {
    next: { revalidate: 60 },   // cache Next.js 1 min
  })
  if (!response.ok) {
    throw new Error(`Jolpica ${path} → HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

// ============================================================
// Mappers
// ============================================================

function mapRaceResult(result: JolpikaRaceResult): [string, DriverResult] {
  const code     = result.Driver.code
  const position = /^\d+$/.test(result.positionText)
    ? parseInt(result.positionText, 10)
    : null
  return [code, {
    position,
    fastestLap: result.FastestLap?.rank === '1',
    dnf:        result.positionText === 'R',
  }]
}

function mapQualifyingResult(result: JolpikaQualifyingResult): [string, DriverResult] {
  return [result.Driver.code, {
    position:  parseInt(result.position, 10),
    fastestLap: false,
  }]
}

// ============================================================
// Résultats de session → Map<driverCode, DriverResult>
// ============================================================

export async function fetchRaceResults(
  year: number,
  round: number,
): Promise<Map<string, DriverResult>> {
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(
    `/${year}/${round}/results`,
  )
  const results = data.MRData.RaceTable.Races[0]?.Results ?? []
  return new Map(results.map(mapRaceResult))
}

export async function fetchQualifyingResults(
  year: number,
  round: number,
): Promise<Map<string, DriverResult>> {
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(
    `/${year}/${round}/qualifying`,
  )
  const results = data.MRData.RaceTable.Races[0]?.QualifyingResults ?? []
  return new Map(results.map(mapQualifyingResult))
}

export async function fetchSprintRaceResults(
  year: number,
  round: number,
): Promise<Map<string, DriverResult>> {
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(
    `/${year}/${round}/sprint`,
  )
  const results = data.MRData.RaceTable.Races[0]?.SprintResults ?? []
  return new Map(results.map(mapRaceResult))
}

// sprint_qualifying (shootout) : non disponible dans Jolpica — utiliser OpenF1
// voir lib/f1/openf1.ts

// ============================================================
// Sync calendrier + pilotes + écuries
// ============================================================

export async function fetchCalendar(year: number): Promise<CalendarEntry[]> {
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(
    `/${year}/races`,
  )
  return data.MRData.RaceTable.Races.map((race) => {
    const fp1 = race.FirstPractice
    const weekendStartsAt = fp1
      ? `${fp1.date}T${fp1.time}`
      : `${race.date}T${race.time ?? '00:00:00Z'}`

    return {
      season:          parseInt(race.season, 10),
      round:           parseInt(race.round, 10),
      name:            race.raceName,
      circuit:         race.Circuit.circuitName,
      country:         race.Circuit.Location.country,
      isSprintWeekend: !!race.Sprint,
      weekendStartsAt,
    }
  })
}

export async function fetchDrivers(year: number): Promise<DriverEntry[]> {
  const data = await jolpikaGet<{
    MRData: { DriverTable: { Drivers: JolpikaDriver[] } }
  }>(`/${year}/drivers`)
  return data.MRData.DriverTable.Drivers.map((d) => ({
    season:    year,
    code:      d.code,
    firstName: d.givenName,
    lastName:  d.familyName,
    number:    parseInt(d.permanentNumber, 10),
  }))
}

export async function fetchConstructors(year: number): Promise<ConstructorEntry[]> {
  const data = await jolpikaGet<{
    MRData: { ConstructorTable: { Constructors: JolpikaConstructor[] } }
  }>(`/${year}/constructors`)
  return data.MRData.ConstructorTable.Constructors.map((c) => ({
    season:        year,
    code:          c.constructorId.toUpperCase().replace(/-/g, '_'),   // "red_bull" → "RED_BULL"
    constructorId: c.constructorId,
    name:          c.name,
  }))
}

// Standings fin de saison / en cours — seule source Jolpica qui lie pilote ↔ écurie
export async function fetchDriverConstructorLinks(year: number): Promise<DriverConstructorLink[]> {
  const data = await jolpikaGet<{
    MRData: {
      StandingsTable: {
        StandingsLists: {
          DriverStandings: {
            Driver:       JolpikaDriver
            Constructors: JolpikaConstructor[]
          }[]
        }[]
      }
    }
  }>(`/${year}/driverStandings`)

  const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
  return standings
    .filter((s) => s.Constructors.length > 0)
    .map((s) => ({
      driverCode:      s.Driver.code,
      constructorCode: s.Constructors[0].constructorId.toUpperCase().replace(/-/g, '_'),
    }))
}
