import { createServiceClient } from '@/lib/supabase'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import type { SessionType } from '@/lib/scoring/types'

export interface PredictionRow {
  userId:  string
  entries: string[]
}

// ── Prédictions de session (scoring phase 1) ──────────────────────────────

export async function getPredictionsForSession(
  sessionId: string,
): Promise<PredictionRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, entries')
    .eq('session_id', sessionId)
    .eq('is_valid', true)

  if (error) throw error
  return (data ?? []).map((row) => ({ userId: row.user_id, entries: row.entries as string[] }))
}

// userId → code pilote prédit pour le meilleur tour
export async function getFastestLapForSession(
  sessionId: string,
): Promise<Map<string, string>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('fastest_lap_predictions')
    .select('user_id, drivers!driver_id(code)')
    .eq('session_id', sessionId)

  if (error) throw error

  const result = new Map<string, string>()
  for (const row of data ?? []) {
    // Embed via FK (`drivers!driver_id`) = relation many-to-one → PostgREST renvoie
    // un objet (pas un tableau). À confirmer en intégration (test plan).
    const driver = (row.drivers as unknown) as ({ code: string } | null)
    if (driver) result.set(row.user_id, driver.code)
  }
  return result
}

// ── Prédictions saison WDC/WCC (scoring fin de saison) ───────────────────

export async function getSeasonPredictions(
  season: number,
  type: 'wdc' | 'wcc',
): Promise<PredictionRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('season_predictions')
    .select('user_id, entries')
    .eq('season', season)
    .eq('type', type)

  if (error) throw error
  return (data ?? []).map((row) => ({ userId: row.user_id, entries: row.entries as string[] }))
}

// ── Écriture (actions utilisateur) ───────────────────────────────────────

export async function submitPrediction(
  userId:      string,
  sessionId:   string,
  season:      number,
  sessionType: SessionType,
  entries:     string[],
): Promise<void> {
  const supabase = createServiceClient()
  const expected = POSITIONS_TO_SCORE[sessionType]
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id:      userId,
        session_id:   sessionId,
        season,
        entries,
        is_valid:     entries.length === expected,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id' },
    )
  if (error) throw error
}

export async function submitFastestLap(
  userId:    string,
  sessionId: string,
  season:    number,
  driverId:  string,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('fastest_lap_predictions')
    .upsert(
      {
        user_id:      userId,
        session_id:   sessionId,
        season,
        driver_id:    driverId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id' },
    )
  if (error) throw error
}
