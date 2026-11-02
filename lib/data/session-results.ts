import { createServiceClient } from '@/lib/supabase'
import { SCOREABLE_SESSION_TYPES } from '@/lib/scoring/types'
import type { DbSessionType, DriverResult } from '@/lib/scoring/types'

// ── Révision des classements (#259) ───────────────────────────────────────

export type RevisableSession = {
  id:           string
  type:         DbSessionType
  season:       number
  startsAt:     string
  gpId:         string
  gpName:       string
  raceStartsAt: string
}

/**
 * Séances scorées confirmées des GPs ni finalisés ni annulés, avec le départ
 * de leur course (borne de la fenêtre de révision, cf. isResultsRevisionOpen).
 * Volume borné : seuls les GPs en attente de finalisation (en pratique le GP
 * du week-end, ≤ 4 séances scorées).
 */
export async function getRevisableSessions(): Promise<RevisableSession[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('id, type, season, starts_at, gp_id, grands_prix!gp_id!inner(name, scoring_finalized_at, is_cancelled)')
    .in('type', [...SCOREABLE_SESSION_TYPES])
    .not('results_confirmed_at', 'is', null)
    .is('grands_prix.scoring_finalized_at', null)
    .eq('grands_prix.is_cancelled', false)

  if (error) throw error
  if (!data?.length) return []

  const { data: races, error: racesError } = await supabase
    .from('sessions')
    .select('gp_id, starts_at')
    .eq('type', 'race')
    .in('gp_id', [...new Set(data.map((row) => row.gp_id))])

  if (racesError) throw racesError
  const raceStartsAtByGp = new Map((races ?? []).map((race) => [race.gp_id, race.starts_at]))

  return data.flatMap((row) => {
    const raceStartsAt = raceStartsAtByGp.get(row.gp_id)
    if (!raceStartsAt || !row.grands_prix) return []
    return [{
      id:       row.id,
      type:     row.type as DbSessionType,
      season:   row.season,
      startsAt: row.starts_at,
      gpId:     row.gp_id,
      gpName:   row.grands_prix.name,
      raceStartsAt,
    }]
  })
}

/** Classement stocké d'une séance : code, id et position de chaque pilote. */
export async function getStoredClassification(
  sessionId: string,
): Promise<{ driverId: string; driverCode: string; position: number | null }[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('session_results')
    .select('driver_id, position, drivers!driver_id(code)')
    .eq('session_id', sessionId)

  if (error) throw error
  return (data ?? []).flatMap((row) =>
    row.drivers ? [{ driverId: row.driver_id, driverCode: row.drivers.code, position: row.position }] : [],
  )
}

/**
 * Applique une révision (RPC transactionnelle apply_session_revision) :
 * nouvelles positions + suppression des scores de la séance, recalculés par le
 * cron de scoring au passage suivant. false = GP finalisé entre-temps, rien
 * n'a été modifié.
 */
export async function applySessionRevision(
  sessionId: string,
  positions: { driverId: string; position: number }[],
): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('apply_session_revision', {
    p_session_id: sessionId,
    p_positions:  positions.map((entry) => ({ driver_id: entry.driverId, position: entry.position })),
  })
  if (error) throw error
  return data === true
}

/** Claim atomique de la notif « scores corrigés » : un seul push par séance révisée. */
export async function claimSessionRevisionNotification(sessionId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .update({ revision_notified_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('revision_notified_at', null)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

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

/**
 * Retourne les codes pilotes du résultat absents de `drivers` pour la saison :
 * leurs lignes sont écartées (pas de FK possible). L'appelant décide s'il peut
 * confirmer la session ou s'il doit différer pour retenter au passage suivant
 * (#212 — cf. lib/data/session-confirmation.ts).
 */
export async function upsertSessionResults(
  sessionId: string,
  season: number,
  results: Map<string, DriverResult>,
): Promise<string[]> {
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

  // Remplaçant vu par la source de résultats (OpenF1) mais pas encore listé par
  // Jolpica : lignes écartées, tracées pour rester observables dans les logs du
  // cron (même patron que upsertGPLineup).
  const unknownCodes = codes.filter((code) => !codeToId.has(code))
  if (unknownCodes.length > 0) {
    console.warn(
      `upsertSessionResults : pilotes absents de drivers pour la saison ${season} — ${unknownCodes.join(', ')} (session ${sessionId})`,
    )
  }

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

  if (rows.length > 0) {
    const { error } = await supabase
      .from('session_results')
      .upsert(rows, { onConflict: 'session_id,driver_id' })

    if (error) throw error
  }

  return unknownCodes
}
