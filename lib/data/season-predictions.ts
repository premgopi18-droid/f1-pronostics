import { createServiceClient } from '@/lib/supabase'

export type SeasonPredictionType = 'wdc' | 'wcc'

export async function getSeasonPrediction(
  userId: string,
  season: number,
  type:   SeasonPredictionType,
): Promise<string[] | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('season_predictions')
    .select('entries')
    .eq('user_id', userId)
    .eq('season', season)
    .eq('type', type)
    .maybeSingle()

  if (error) throw error
  return data ? (data.entries as string[]) : null
}

export async function upsertSeasonPrediction(
  userId:  string,
  season:  number,
  type:    SeasonPredictionType,
  entries: string[],
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('season_predictions')
    .upsert(
      {
        user_id:      userId,
        season,
        type,
        entries,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,season,type' },
    )
  if (error) throw error
}

// Deadline soumission = qualifs du 1er GP · Deadline items saison = qualifs du dernier GP
export async function getSeasonDeadlines(season: number): Promise<{
  submissionDeadline: Date | null
  itemDeadline:       Date | null
}> {
  const supabase = createServiceClient()

  const { data: gps, error: gpError } = await supabase
    .from('grands_prix')
    .select('id, round')
    .eq('season', season)
    .eq('is_cancelled', false)
    .order('round', { ascending: true })

  if (gpError) throw gpError
  if (!gps || gps.length === 0) return { submissionDeadline: null, itemDeadline: null }

  const firstGpId = gps[0].id as string
  const lastGpId  = gps[gps.length - 1].id as string

  const [{ data: firstQual, error: e1 }, { data: lastQual, error: e2 }] = await Promise.all([
    supabase
      .from('sessions')
      .select('starts_at')
      .eq('gp_id', firstGpId)
      .eq('type', 'qualifying')
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('starts_at')
      .eq('gp_id', lastGpId)
      .eq('type', 'qualifying')
      .maybeSingle(),
  ])

  if (e1) throw e1
  if (e2) throw e2

  return {
    submissionDeadline: firstQual ? new Date(firstQual.starts_at as string) : null,
    itemDeadline:       lastQual  ? new Date(lastQual.starts_at as string)  : null,
  }
}

// Stock d'items saison (wdc_move / wcc_move) dans une ligue
export async function getSeasonItems(
  userId:   string,
  leagueId: string,
  season:   number,
): Promise<{ wdcMove: number; wccMove: number }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_items')
    .select('item_type, uses_remaining')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('season', season)
    .in('item_type', ['wdc_move', 'wcc_move'])

  if (error) throw error

  let wdcMove = 0
  let wccMove = 0
  for (const row of data ?? []) {
    if (row.item_type === 'wdc_move') wdcMove = row.uses_remaining as number
    if (row.item_type === 'wcc_move') wccMove = row.uses_remaining as number
  }
  return { wdcMove, wccMove }
}
