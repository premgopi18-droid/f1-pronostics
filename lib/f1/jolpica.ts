import type { DriverResult } from '@/lib/scoring/types'

const BASE_URL = 'https://api.jolpi.ca/ergast/f1'

// ============================================================
// Types internes — structure de réponse Jolpica (subset utile)
// ============================================================

interface JolpikaDriver {
  code?:      string   // "VER", "NOR" — ABSENT pour un réserviste/rookie sans trigramme officiel (#255)
  driverId:   string   // "verstappen"
  givenName:  string
  familyName: string
  permanentNumber?: string
}

interface JolpikaConstructor {
  constructorId: string  // "red_bull"
  name:          string
}

export interface JolpikaRaceResult {
  number?:      string   // numéro de voiture sur CETTE course — rattache un pilote sans trigramme (#255)
  position:     string
  positionText: string   // "1".."20", "R"=Retired (DNF), "W"=Withdrew (DNS), "D"=DSQ, "N"=non-classé
  Driver:       JolpikaDriver
  Constructor?: JolpikaConstructor   // écurie du pilote pour CETTE course (fiable même en cas de remplacement)
  FastestLap?:  { rank: string }
  laps?:        string   // tours effectués par le pilote (le vainqueur = distance de course)
}

export interface JolpikaQualifyingResult {
  number?:      string
  position:     string
  Driver:       JolpikaDriver
  Constructor?: JolpikaConstructor
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
  SecondPractice?:   { date: string; time: string }
  ThirdPractice?:    { date: string; time: string }
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
  isSprintWeekend:     boolean
  weekendStartsAt:     string        // Début du GP = 1ère session de compétition (sprint qualif ?? qualif), hors essais — ISO 8601
  qualifyingStartsAt:  string
  raceStartsAt:        string
  sprintRaceStartsAt:  string | null
  sprintQualStartsAt:  string | null
  practice1StartsAt:   string | null
  practice2StartsAt:   string | null
  practice3StartsAt:   string | null
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

export function mapRaceResult(result: JolpikaRaceResult): DriverResult {
  return {
    position:        parseInt(result.position, 10),
    fastestLap:      result.FastestLap?.rank === '1',
    dnf:             result.positionText === 'R',
    dns:             result.positionText === 'W',
    constructorCode: result.Constructor ? toConstructorCode(result.Constructor.constructorId) : null,
  }
}

function mapQualifyingResult(result: JolpikaQualifyingResult): DriverResult {
  return {
    position:        parseInt(result.position, 10),
    fastestLap:      false,
    constructorCode: result.Constructor ? toConstructorCode(result.Constructor.constructorId) : null,
  }
}

/**
 * Numéro de voiture → trigramme, construit depuis les pilotes connus de la
 * saison. Un numéro porté par plusieurs pilotes est ambigu : exclu plutôt que
 * de rattacher un résultat au mauvais pilote.
 */
export function buildDriverCodeByNumber(
  drivers: { code: string; number: number | null }[],
): Map<number, string> {
  const codesByNumber = new Map<number, string[]>()
  for (const driver of drivers) {
    if (driver.number == null) continue
    codesByNumber.set(driver.number, [...(codesByNumber.get(driver.number) ?? []), driver.code])
  }
  const codeByNumber = new Map<number, string>()
  for (const [number, codes] of codesByNumber) {
    if (codes.length === 1) codeByNumber.set(number, codes[0])
  }
  return codeByNumber
}

/**
 * Trigramme d'une ligne de résultat : `Driver.code`, sinon rattachement par
 * numéro de voiture à un pilote connu (#255 — Hirakawa, Mexique 2026 : classé
 * par Jolpica avec son numéro mais sans trigramme). null = inattribuable.
 */
export function resolveResultDriverCode(
  result: { number?: string; Driver: JolpikaDriver },
  codeByNumber: ReadonlyMap<number, string>,
): string | null {
  if (result.Driver.code) return result.Driver.code
  const number = result.number ? parseInt(result.number, 10) : NaN
  return codeByNumber.get(number) ?? null
}

// Classement indexé par trigramme. Une ligne inattribuable est écartée avec un
// warning : pilote inconnu de `drivers`, donc non pronostiquable — aucun point
// n'en dépend, les positions des autres pilotes restent celles de la source.
function mapResultRows<T extends { number?: string; Driver: JolpikaDriver }>(
  rows: T[],
  codeByNumber: ReadonlyMap<number, string>,
  mapRow: (row: T) => DriverResult,
  path: string,
): Map<string, DriverResult> {
  const results = new Map<string, DriverResult>()
  for (const row of rows) {
    const code = resolveResultDriverCode(row, codeByNumber)
    if (!code) {
      console.warn(`Jolpica ${path} : pilote sans trigramme ni numéro connu écarté — ${row.Driver.driverId} (n° ${row.number ?? '?'})`)
      continue
    }
    results.set(code, mapRow(row))
  }
  return results
}

// Normalise un constructorId Jolpica ("red_bull") en code interne ("RED_BULL").
// Source unique de la transformation — fetchConstructors et fetchDriverConstructorLinks
// doivent produire des codes identiques, sinon getConstructorDriversMap ne matche plus.
function toConstructorCode(constructorId: string): string {
  return constructorId.toUpperCase().replace(/-/g, '_')
}

// ============================================================
// Résultats de session → Map<driverCode, DriverResult>
// `codeByNumber` (cf. buildDriverCodeByNumber) rattache les lignes sans
// trigramme (#255).
// ============================================================

export async function fetchRaceResults(
  year: number,
  round: number,
  codeByNumber: ReadonlyMap<number, string>,
): Promise<Map<string, DriverResult>> {
  const path = `/${year}/${round}/results`
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(path)
  const results = data.MRData.RaceTable.Races[0]?.Results ?? []
  return mapResultRows(results, codeByNumber, mapRaceResult, path)
}

// Nombre de tours de la course = tours effectués par le vainqueur (position 1).
// `null` si la course n'a pas de résultats (pas encore courue) ou donnée absente.
export async function fetchRaceLaps(year: number, round: number): Promise<number | null> {
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(
    `/${year}/${round}/results`,
  )
  const results = data.MRData.RaceTable.Races[0]?.Results ?? []
  const winner = results.find((result) => result.position === '1') ?? results[0]
  const laps = winner?.laps ? parseInt(winner.laps, 10) : NaN
  return Number.isFinite(laps) && laps > 0 ? laps : null
}

export async function fetchQualifyingResults(
  year: number,
  round: number,
  codeByNumber: ReadonlyMap<number, string>,
): Promise<Map<string, DriverResult>> {
  const path = `/${year}/${round}/qualifying`
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(path)
  const results = data.MRData.RaceTable.Races[0]?.QualifyingResults ?? []
  return mapResultRows(results, codeByNumber, mapQualifyingResult, path)
}

export async function fetchSprintRaceResults(
  year: number,
  round: number,
  codeByNumber: ReadonlyMap<number, string>,
): Promise<Map<string, DriverResult>> {
  const path = `/${year}/${round}/sprint`
  const data = await jolpikaGet<{ MRData: { RaceTable: { Races: JolpikaRace[] } } }>(path)
  const results = data.MRData.RaceTable.Races[0]?.SprintResults ?? []
  return mapResultRows(results, codeByNumber, mapRaceResult, path)
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
    const qual          = race.Qualifying
    const raceStartsAt  = `${race.date}T${race.time ?? '00:00:00Z'}`
    const qualifyingStartsAt = qual
      ? `${qual.date}T${qual.time}`
      : raceStartsAt  // fallback : date course
    const sprintQualStartsAt = race.SprintQualifying
      ? `${race.SprintQualifying.date}T${race.SprintQualifying.time}`
      : null
    // Début du GP = 1ère session de compétition (sprint qualif en week-end sprint,
    // sinon qualif). On exclut volontairement les essais libres (FP1) : pour les
    // pronostics, le GP « commence » au premier verrouillage, pas aux essais.
    const weekendStartsAt = sprintQualStartsAt ?? qualifyingStartsAt

    return {
      season:             parseInt(race.season, 10),
      round:              parseInt(race.round, 10),
      name:               race.raceName,
      circuit:            race.Circuit.circuitName,
      country:            race.Circuit.Location.country,
      isSprintWeekend:    !!race.Sprint,
      weekendStartsAt,
      qualifyingStartsAt,
      raceStartsAt,
      sprintRaceStartsAt: race.Sprint
        ? `${race.Sprint.date}T${race.Sprint.time}`
        : null,
      sprintQualStartsAt,
      practice1StartsAt: race.FirstPractice
        ? `${race.FirstPractice.date}T${race.FirstPractice.time}`
        : null,
      practice2StartsAt: race.SecondPractice
        ? `${race.SecondPractice.date}T${race.SecondPractice.time}`
        : null,
      practice3StartsAt: race.ThirdPractice
        ? `${race.ThirdPractice.date}T${race.ThirdPractice.time}`
        : null,
    }
  })
}

export async function fetchDrivers(year: number): Promise<DriverEntry[]> {
  const data = await jolpikaGet<{
    MRData: { DriverTable: { Drivers: JolpikaDriver[] } }
  }>(`/${year}/drivers`)
  // Pilotes sans trigramme (rookies des EL1, réserviste tout juste titularisé)
  // écartés : sans code, pas d'identité stable. Un remplaçant qui roule pour de
  // vrai est inscrit depuis OpenF1 (#255, cf. enrollReplacementDrivers).
  return data.MRData.DriverTable.Drivers
    .filter((d): d is JolpikaDriver & { code: string } => !!d.code)
    .map((d) => ({
      season:    year,
      code:      d.code,
      firstName: d.givenName,
      lastName:  d.familyName,
      number:    d.permanentNumber ? parseInt(d.permanentNumber, 10) : NaN,
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
  return new Map(
    standings
      .filter((s) => !!s.Driver.code)
      .map((s) => [s.Driver.code!, parseInt(s.position, 10)]),
  )
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
    .filter((s) => s.Constructors.length > 0 && !!s.Driver.code)
    .map((s) => ({
      driverCode: s.Driver.code!,
      // Jolpica liste les écuries par ordre chronologique — on prend la dernière
      // (= écurie actuelle). Edge case connu : si un pilote change d'équipe en cours
      // de saison, getConstructorDriversMap sera inexact pour les courses antérieures
      // au transfert (impact limité à l'item no_points_team, cas rarissime en F1).
      constructorCode: toConstructorCode(s.Constructors[s.Constructors.length - 1].constructorId),
    }))
}
