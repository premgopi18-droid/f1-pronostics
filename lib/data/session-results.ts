import { createServiceClient } from '@/lib/supabase'
import type { DriverResult } from '@/lib/scoring/types'

// ── Lecture ───────────────────────────────────────────────────────────────

export async function getResultsForSession(
  sessionId: string,
): Promise<Map<string, DriverResult>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('session_results')
    .select('position, dnf, fastest_lap, constructor_code, drivers!driver_id(code)')
    .eq('session_id', sessionId)

  if (error) throw error

  const result = new Map<string, DriverResult>()
  for (const row of data ?? []) {
    const driver = row.drivers
    if (driver) {
      result.set(driver.code, {
        position:        row.position,
        fastestLap:      row.fastest_lap,
        dnf:             row.dnf,
        constructorCode: row.constructor_code,
      })
    }
  }
  return result
}

// constructorCode → [driverCode, driverCode] — mapping SAISON (drivers.constructor_id).
// Fallback pour les sessions sans constructor_code (antérieures à #205) ; inexact en
// cas de changement d'écurie en cours de saison — préférer buildConstructorDrivers
// (lib/scoring/resolve-items.ts) sur les résultats de la course quand ils sont renseignés.
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
    const constructor = row.constructors
    if (!constructor) continue
    const drivers = result.get(constructor.code) ?? []
    drivers.push(row.code)
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

  const codeToId = new Map((drivers ?? []).map((d) => [d.code, d.id]))

  const rows = Array.from(results.entries())
    .filter(([code]) => codeToId.has(code))
    .map(([code, result]) => ({
      session_id:       sessionId,
      season,
      driver_id:        codeToId.get(code)!,
      position:         result.position,
      dnf:              result.dnf ?? false,
      dns:              result.dns ?? false,
      fastest_lap:      result.fastestLap,
      best_lap_time:    result.bestLapTime ?? null,
      constructor_code: result.constructorCode ?? null,
    }))

  const { error } = await supabase
    .from('session_results')
    .upsert(rows, { onConflict: 'session_id,driver_id' })

  if (error) throw error
}
