import { createClient } from '@/lib/supabase'

export interface PredictionRow {
  userId:  string
  entries: string[]
}

// ── Prédictions de session (scoring phase 1) ──────────────────────────────

export async function getPredictionsForSession(
  sessionId: string,
): Promise<PredictionRow[]> {
  const supabase = await createClient()
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fastest_lap_predictions')
    .select('user_id, drivers!driver_id(code)')
    .eq('session_id', sessionId)

  if (error) throw error

  const result = new Map<string, string>()
  for (const row of data ?? []) {
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('season_predictions')
    .select('user_id, entries')
    .eq('season', season)
    .eq('type', type)

  if (error) throw error
  return (data ?? []).map((row) => ({ userId: row.user_id, entries: row.entries as string[] }))
}
