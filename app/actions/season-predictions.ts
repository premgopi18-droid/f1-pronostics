'use server'

import { createClient, createServiceClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import {
  getSeasonDeadlines,
  upsertSeasonPrediction,
  type SeasonPredictionType,
} from '@/lib/data/season-predictions'
import { WDC_COUNT, WCC_COUNT } from '@/lib/season/constants'

export type SeasonPredictionResult = { error: string } | { ok: true }

export async function submitSeasonPredictionAction(
  type:    SeasonPredictionType,
  entries: string[],
): Promise<SeasonPredictionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const season = getCurrentSeason()

  const { submissionDeadline } = await getSeasonDeadlines(season, user.id)
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
    validCodes = new Set((drivers ?? []).map((d) => d.code))
  } else {
    const { data: constructors, error } = await db
      .from('constructors')
      .select('code')
      .eq('season', season)
    if (error) return { error: 'Erreur serveur' }
    validCodes = new Set((constructors ?? []).map((c) => c.code))
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

// Apply wdc_move / wcc_move : pull-and-shift d'une position à une autre.
// Ces items sont globaux (1 par user par saison, indépendant des ligues).
export async function applySeasonItemAction(
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

  // Décrément gardé + pull-and-shift de `entries` + log items_played en une seule
  // transaction (RPC apply_season_item). Évite l'échec partiel (prédiction mutée
  // sans décrément) et la sur-dépense concurrente. Le `code` déplacé est résolu
  // côté SQL et écrit dans le payload du log.
  const db = createServiceClient()
  const { error } = await db.rpc('apply_season_item', {
    p_user_id:   user.id,
    p_season:    season,
    p_item_type: itemType,
    p_from:      fromPosition,
    p_to:        toPosition,
  })

  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0001') return { error: 'Item épuisé pour cette saison' }
    if (code === 'P0002') return { error: 'Soumets d\'abord ton pronostic saison avant d\'utiliser cet item' }
    if (code === 'P0003') return { error: 'Positions invalides' }
    return { error: 'Erreur inattendue' }
  }
  return { ok: true }
}
