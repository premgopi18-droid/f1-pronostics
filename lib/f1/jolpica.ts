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
  FirstPractice?:    { date: string; time: string }
  Qualifying?:       { date: string; time: string }
  SprintQualifying?: { date: string; time: string }  // shootout — Jolpica v1.4+
  Sprint?:           { date: string; time: string }  // sprint race
  Results?:            JolpikaRaceResult[]
  QualifyingResults?:  JolpikaQualifyingResult[]
  SprintResults?:      JolpikaRaceResult[]
}

// Shapes renvoyés par les fonctions de sync (→ lib/data/)
export interface CalendarEntry {
  season:              number
  round:               number
  name:                string
  circuit:             string
  country:             string
  circuitShortName:    string        // locality Jolpica — best-effort pour OpenF1
  isSprintWeekend:     boolean
  weekendStartsAt:     string        // FP1 ou date course — ISO 8601
  qualifyingStartsAt:  string
  raceStartsAt:        string
  sprintRaceStartsAt:  string | null
  sprintQualStartsAt:  string | null
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
  const code = result.Driver.code
  return [code, {
    position:  parseInt(result.position, 10),
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

// Normalise un constructorId Jolpica ("red_bull") en code interne ("RED_BULL").
// Source unique de la transformation — fetchConstructors et fetchDriverConstructorLinks
// doivent produire des codes identiques, sinon getConstructorDriversMap ne matche plus.
function toConstructorCode(constructorId: string): string {
  return constructorId.toUpperCase().replace(/-/g, '_')
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
    const fp1  = race.FirstPractice
    const qual = race.Qualifying
    const weekendStartsAt = fp1
      ? `${fp1.date}T${fp1.time}`
      : `${race.date}T${race.time ?? '00:00:00Z'}`

    return {
      season:             parseInt(race.season, 10),
      round:              parseInt(race.round, 10),
      name:               race.raceName,
      circuit:            race.Circuit.circuitName,
      country:            race.Circuit.Location.country,
      circuitShortName:   race.Circuit.Location.locality,
      isSprintWeekend:    !!race.Sprint,
      weekendStartsAt,
      qualifyingStartsAt: qual
        ? `${qual.date}T${qual.time}`
        : `${race.date}T${race.time ?? '00:00:00Z'}`,  // fallback : date course
      raceStartsAt:       `${race.date}T${race.time ?? '00:00:00Z'}`,
      sprintRaceStartsAt: race.Sprint
        ? `${race.Sprint.date}T${race.Sprint.time}`
        : null,
      sprintQualStartsAt: race.SprintQualifying
        ? `${race.SprintQualifying.date}T${race.SprintQualifying.time}`
        : null,
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
    code:          toConstructorCode(c.constructorId),   // "red_bull" → "RED_BULL"
    constructorId: c.constructorId,
    name:          c.name,
  }))
}

// Classements finaux (ou en cours) WDC — code pilote → position
export async function fetchDriverStandings(year: number): Promise<Map<string, number>> {
  const data = await jolpikaGet<{
    MRData: {
      StandingsTable: {
        StandingsLists: {
          DriverStandings: { position: string; Driver: JolpikaDriver }[]
        }[]
      }
    }
  }>(`/${year}/driverStandings`)
  const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
  return new Map(standings.map((s) => [s.Driver.code, parseInt(s.position, 10)]))
}

// Classements finaux (ou en cours) WCC — code écurie → position
export async function fetchConstructorStandings(year: number): Promise<Map<string, number>> {
  const data = await jolpikaGet<{
    MRData: {
      StandingsTable: {
        StandingsLists: {
          ConstructorStandings: { position: string; Constructor: JolpikaConstructor }[]
        }[]
      }
    }
  }>(`/${year}/constructorStandings`)
  const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
  return new Map(standings.map((s) => [toConstructorCode(s.Constructor.constructorId), parseInt(s.position, 10)]))
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
      driverCode: s.Driver.code,
      // Jolpica liste les écuries par ordre chronologique — on prend la dernière
      // (= écurie actuelle). Edge case connu : si un pilote change d'équipe en cours
      // de saison, getConstructorDriversMap sera inexact pour les courses antérieures
      // au transfert (impact limité à l'item no_points_team, cas rarissime en F1).
      constructorCode: toConstructorCode(s.Constructors[s.Constructors.length - 1].constructorId),
    }))
}
