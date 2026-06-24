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

// Deadline soumission = Q1 du premier GP après la date d'inscription de l'user (per-user)
// Deadline items saison = qualifs du dernier GP (globale)
export async function getSeasonDeadlines(
  season: number,
  userId?: string,
): Promise<{
  submissionDeadline: Date | null
  itemDeadline:       Date | null
}> {
  const supabase = createServiceClient()

  const [{ data: gps, error: gpError }, userLookup] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, round')
      .eq('season', season)
      .eq('is_cancelled', false)
      .order('round', { ascending: true }),
    userId ? supabase.auth.admin.getUserById(userId) : Promise.resolve(null),
  ])

  if (gpError) throw gpError
  if (userLookup?.error) throw userLookup.error
  if (!gps || gps.length === 0) return { submissionDeadline: null, itemDeadline: null }

  const gpIds = gps.map((gp) => gp.id as string)
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('gp_id, starts_at')
    .in('gp_id', gpIds)
    .eq('type', 'qualifying')

  if (sessionError) throw sessionError

  const qualMap = new Map<string, Date>()
  for (const s of sessions ?? []) {
    qualMap.set(s.gp_id as string, new Date(s.starts_at as string))
  }

  // Q1 de chaque GP dans l'ordre du calendrier
  const orderedQuals = gps
    .map((gp) => qualMap.get(gp.id as string))
    .filter((d): d is Date => d !== undefined)

  // Deadline soumission per-user : premier Q1 strictement après la date d'inscription.
  // Fallback sur Q1 GP1 dans deux cas : (a) user présent avant le début de saison,
  // (b) user inscrit après le dernier Q1 (find renvoie undefined) → Q1 GP1 dans le passé
  //     → form verrouillée (saison terminée).
  let submissionDeadline: Date | null = orderedQuals[0] ?? null
  if (userId && userLookup?.data) {
    const userCreatedAt = new Date(userLookup.data.user.created_at)
    submissionDeadline = orderedQuals.find((d) => d > userCreatedAt) ?? orderedQuals[0] ?? null
  }

  return {
    submissionDeadline,
    itemDeadline: orderedQuals.at(-1) ?? null,
  }
}

// Toutes les prédictions saison d'un type pour une saison — utilisé par le moteur de scoring.
export async function getAllSeasonPredictions(
  season: number,
  type:   SeasonPredictionType,
): Promise<Map<string, string[]>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('season_predictions')
    .select('user_id, entries')
    .eq('season', season)
    .eq('type', type)
  if (error) throw error
  return new Map((data ?? []).map((row) => [row.user_id as string, row.entries as string[]]))
}

// Stock d'items saison globaux (wdc_move / wcc_move) — 1 par user par saison, toutes ligues confondues.
// Si aucune ligne n'existe encore, l'item est disponible (valeur par défaut : 1).
export async function getSeasonItems(
  userId: string,
  season: number,
): Promise<{ wdcMove: number; wccMove: number }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_season_items')
    .select('item_type, uses_remaining')
    .eq('user_id', userId)
    .eq('season', season)

  if (error) throw error

  let wdcMove = 1
  let wccMove = 1
  for (const row of data ?? []) {
    if (row.item_type === 'wdc_move') wdcMove = row.uses_remaining as number
    if (row.item_type === 'wcc_move') wccMove = row.uses_remaining as number
  }
  return { wdcMove, wccMove }
}
