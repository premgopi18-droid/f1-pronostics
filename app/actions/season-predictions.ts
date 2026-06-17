'use server'

import { createClient, createServiceClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import {
  getSeasonDeadlines,
  upsertSeasonPrediction,
  getSeasonPrediction,
  type SeasonPredictionType,
} from '@/lib/data/season-predictions'

export type SeasonPredictionResult = { error: string } | { ok: true }

const WDC_COUNT = 10
const WCC_COUNT = 11

export async function submitSeasonPredictionAction(
  type:    SeasonPredictionType,
  entries: string[],
): Promise<SeasonPredictionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const season = getCurrentSeason()

  const { submissionDeadline } = await getSeasonDeadlines(season)
  if (submissionDeadline && new Date() >= submissionDeadline) {
    return { error: 'Deadline passée — pronostics saison verrouillés' }
  }

  const expectedCount = type === 'wdc' ? WDC_COUNT : WCC_COUNT
  if (!Array.isArray(entries) || entries.length !== expectedCount) {
    return { error: `${expectedCount} entrées requises` }
  }

  // Codes valides depuis la DB
  const db = createServiceClient()
  let validCodes: Set<string>

  if (type === 'wdc') {
    const { data: drivers, error } = await db
      .from('drivers')
      .select('code')
      .eq('season', season)
    if (error) return { error: 'Erreur serveur' }
    validCodes = new Set((drivers ?? []).map((d) => d.code as string))
  } else {
    const { data: constructors, error } = await db
      .from('constructors')
      .select('code')
      .eq('season', season)
    if (error) return { error: 'Erreur serveur' }
    validCodes = new Set((constructors ?? []).map((c) => c.code as string))
  }

  for (const code of entries) {
    if (!validCodes.has(code)) return { error: `Code invalide : ${code}` }
  }

  if (new Set(entries).size !== entries.length) {
    return { error: 'Doublons détectés' }
  }

  try {
    await upsertSeasonPrediction(user.id, season, type, entries)
    return { ok: true }
  } catch {
    return { error: 'Erreur inattendue' }
  }
}

// Apply wdc_move / wcc_move : pull-and-shift d'une position à une autre
export async function applySeasonItemAction(
  leagueId:     string,
  itemType:     'wdc_move' | 'wcc_move',
  fromPosition: number,
  toPosition:   number,
): Promise<SeasonPredictionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const season = getCurrentSeason()
  const type: SeasonPredictionType = itemType === 'wdc_move' ? 'wdc' : 'wcc'
  const maxPos = type === 'wdc' ? WDC_COUNT : WCC_COUNT

  if (
    !Number.isInteger(fromPosition) || !Number.isInteger(toPosition) ||
    fromPosition < 1 || fromPosition > maxPos ||
    toPosition   < 1 || toPosition   > maxPos ||
    fromPosition === toPosition
  ) {
    return { error: 'Positions invalides' }
  }

  const { submissionDeadline, itemDeadline } = await getSeasonDeadlines(season)
  if (submissionDeadline && new Date() < submissionDeadline) {
    return { error: 'Les pronostics saison ne sont pas encore verrouillés' }
  }
  if (itemDeadline && new Date() >= itemDeadline) {
    return { error: 'Deadline passée — items saison verrouillés' }
  }

  // Membership
  const { data: membership } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .eq('season', season)
    .maybeSingle()
  if (!membership) return { error: 'Tu n\'es pas membre de cette ligue' }

  // uses_remaining > 0
  const db = createServiceClient()
  const { data: itemRow } = await db
    .from('user_items')
    .select('uses_remaining')
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('item_type', itemType)
    .maybeSingle()

  if (!itemRow || (itemRow.uses_remaining as number) <= 0) {
    return { error: 'Item épuisé pour cette saison' }
  }

  // Prédiction existante requise
  const entries = await getSeasonPrediction(user.id, season, type)
  if (!entries) return { error: 'Soumets d\'abord ton pronostic saison avant d\'utiliser cet item' }

  // Pull-and-shift
  const newEntries = [...entries]
  const [extracted] = newEntries.splice(fromPosition - 1, 1)
  newEntries.splice(toPosition - 1, 0, extracted)

  try {
    await upsertSeasonPrediction(user.id, season, type, newEntries)

    // Log dans items_played (gp_id = null = item saison)
    await db.from('items_played').insert({
      user_id:   user.id,
      league_id: leagueId,
      gp_id:     null,
      season,
      item_type: itemType,
      payload:   { from_position: fromPosition, to_position: toPosition },
    })

    // Décrément uses_remaining
    await db
      .from('user_items')
      .update({ uses_remaining: (itemRow.uses_remaining as number) - 1 })
      .eq('user_id', user.id)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('item_type', itemType)

    return { ok: true }
  } catch {
    return { error: 'Erreur inattendue' }
  }
}
