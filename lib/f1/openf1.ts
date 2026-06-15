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
// Helper HTTP
// ============================================================

async function openf1Get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: 30 },
  })
  if (!response.ok) {
    throw new Error(`OpenF1 ${path} → HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
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
  const session = sessions[0]
  if (!session) return new Map()

  // 2. Pilotes de la session → code acronyme
  const [drivers, positions] = await Promise.all([
    openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`),
    openf1Get<OpenF1Position[]>(`/position?session_key=${session.session_key}`),
  ])

  const numberToCode = new Map(drivers.map((d) => [d.driver_number, d.name_acronym]))

  // 3. Garder la dernière position connue par pilote (= classement final)
  const finalPositions = new Map<number, number>()
  for (const entry of positions) {
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
