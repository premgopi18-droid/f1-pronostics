import type { DriverResult } from '@/lib/scoring/types'

const BASE_URL = 'https://api.openf1.org/v1'

// ============================================================
// Types internes — structure de réponse OpenF1 (subset utile)
// ============================================================

interface OpenF1Session {
  session_key:  number
  session_name: string   // "Sprint Qualifying", "Race", etc.
  year:         number
  circuit_short_name: string
  date_end:     string   // ISO — fin officielle de la session
}

interface OpenF1Lap {
  driver_number: number
  lap_duration:  number | null  // secondes ; null sur les tours in/out
}

interface OpenF1Driver {
  driver_number: number
  name_acronym:  string  // "VER", "NOR" — équivalent du code Jolpica
  session_key:   number
}

interface OpenF1Position {
  driver_number: number
  position:      number
  date:          string  // ISO — entrée la plus récente = position finale
}

// ============================================================
// Types publics — essais libres
// ============================================================

export type PracticeSessionName = 'Practice 1' | 'Practice 2' | 'Practice 3'

export type PracticeDriverResult = {
  position:   number
  driverCode: string
}

// ============================================================
// Helper HTTP
// ============================================================

async function openf1Get<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: 30 },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`OpenF1 ${path} → HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

// OpenF1 publie les positions/tours EN DIRECT pendant la session : on n'exploite
// le classement qu'une fois la session terminée, sinon on figerait un ordre
// intermédiaire (le cron confirme dès qu'il obtient un résultat non vide).
function isSessionFinished(session: OpenF1Session): boolean {
  return new Date(session.date_end).getTime() <= Date.now()
}

// ============================================================
// Sprint Qualifying (Shootout) — non disponible dans Jolpica
// Retourne la classification finale : code → position
// ============================================================

export async function fetchSprintQualifyingResults(
  year: number,
  circuitShortName: string,
): Promise<Map<string, DriverResult>> {
  // 1. Trouver la session_key du Sprint Qualifying
  const sessions = await openf1Get<OpenF1Session[]>(
    `/sessions?year=${year}&session_name=Sprint+Qualifying&circuit_short_name=${encodeURIComponent(circuitShortName)}`,
  )
  if (!sessions?.length) return new Map()
  const session = sessions[0]
  if (!isSessionFinished(session)) return new Map()

  // 2. Pilotes de la session → code acronyme
  const [drivers, positions] = await Promise.all([
    openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`),
    openf1Get<OpenF1Position[]>(`/position?session_key=${session.session_key}`),
  ])

  const numberToCode = new Map((drivers ?? []).map((d) => [d.driver_number, d.name_acronym]))

  // 3. Garder la dernière position connue par pilote (= classement final)
  const finalPositions = new Map<number, number>()
  for (const entry of positions ?? []) {
    finalPositions.set(entry.driver_number, entry.position)
  }

  const result = new Map<string, DriverResult>()
  for (const [number, position] of finalPositions) {
    const code = numberToCode.get(number)
    if (code) {
      result.set(code, { position, fastestLap: false })
    }
  }
  return result
}

// ============================================================
// Essais libres (EL1/EL2/EL3) — non disponible dans Jolpica
// Le classement d'une séance d'essais est trié par MEILLEUR TOUR (feuille de
// temps), pas par position sur la piste — on dérive donc le classement depuis
// /laps (min lap_duration par pilote), et non depuis /position.
// ============================================================

export async function fetchPracticeResults(
  year: number,
  circuitShortName: string,
  sessionName: PracticeSessionName,
): Promise<PracticeDriverResult[]> {
  const sessions = await openf1Get<OpenF1Session[]>(
    `/sessions?year=${year}&session_name=${encodeURIComponent(sessionName)}&circuit_short_name=${encodeURIComponent(circuitShortName)}`,
  )
  if (!sessions?.length) return []
  const session = sessions[0]
  if (!isSessionFinished(session)) return []

  const [drivers, laps] = await Promise.all([
    openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`),
    openf1Get<OpenF1Lap[]>(`/laps?session_key=${session.session_key}`),
  ])

  const numberToCode = new Map((drivers ?? []).map((d) => [d.driver_number, d.name_acronym]))

  // Meilleur tour par pilote (les tours in/out ont lap_duration null → ignorés).
  const bestLapByDriver = new Map<number, number>()
  for (const lap of laps ?? []) {
    if (lap.lap_duration == null) continue
    const current = bestLapByDriver.get(lap.driver_number)
    if (current === undefined || lap.lap_duration < current) {
      bestLapByDriver.set(lap.driver_number, lap.lap_duration)
    }
  }

  // Classement = meilleurs tours croissants ; positions denses 1..N.
  const ranked = [...bestLapByDriver.entries()].sort((a, b) => a[1] - b[1])
  const results: PracticeDriverResult[] = []
  let position = 1
  for (const [number] of ranked) {
    const code = numberToCode.get(number)
    if (!code) continue
    results.push({ position: position++, driverCode: code })
  }

  return results
}
