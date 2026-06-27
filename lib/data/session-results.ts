import { createServiceClient } from '@/lib/supabase'
import type { DriverResult } from '@/lib/scoring/types'

// ── Lecture ───────────────────────────────────────────────────────────────

export async function getResultsForSession(
  sessionId: string,
): Promise<Map<string, DriverResult>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('session_results')
    .select('position, dnf, fastest_lap, drivers!driver_id(code)')
    .eq('session_id', sessionId)

  if (error) throw error

  const result = new Map<string, DriverResult>()
  for (const row of data ?? []) {
    const driver = (row.drivers as unknown) as ({ code: string } | null)
    if (driver) {
      result.set(driver.code, {
        position:   row.position as number | null,
        fastestLap: row.fastest_lap as boolean,
        dnf:        row.dnf as boolean,
      })
    }
  }
  return result
}

// constructorCode → [driverCode, driverCode] — utilisé pour no_points_team
export async function getConstructorDriversMap(
  season: number,
): Promise<Map<string, string[]>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('code, constructors!constructor_id(code)')
    .eq('season', season)

  if (error) throw error

  const result = new Map<string, string[]>()
  for (const row of data ?? []) {
    const constructor = (row.constructors as unknown) as ({ code: string } | null)
    if (!constructor) continue
    const drivers = result.get(constructor.code) ?? []
    drivers.push(row.code as string)
    result.set(constructor.code, drivers)
  }
  return result
}

// ── Écriture ──────────────────────────────────────────────────────────────

export async function upsertSessionResults(
  sessionId: string,
  season: number,
  results: Map<string, DriverResult>,
): Promise<void> {
  const supabase = createServiceClient()

  // Résolution code → UUID pour les pilotes de cette saison
  const codes = Array.from(results.keys())
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, code')
    .eq('season', season)
    .in('code', codes)

  if (driversError) throw driversError

  const codeToId = new Map((drivers ?? []).map((d) => [d.code as string, d.id as string]))

  const rows = Array.from(results.entries())
    .filter(([code]) => codeToId.has(code))
    .map(([code, result]) => ({
      session_id:    sessionId,
      season,
      driver_id:     codeToId.get(code)!,
      position:      result.position,
      dnf:           result.dnf ?? false,
      fastest_lap:   result.fastestLap,
      best_lap_time: result.bestLapTime ?? null,
    }))

  const { error } = await supabase
    .from('session_results')
    .upsert(rows, { onConflict: 'session_id,driver_id' })

  if (error) throw error
}
