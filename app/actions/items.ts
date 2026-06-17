'use server'

import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { insertPlayedItem } from '@/lib/data/items'
import {
  OFFENSIVE_ITEMS,
  toDBPayload,
  validatePayload,
  type BlockDriverPayload,
  type PlayItemInput,
  type WildCardPayload,
} from './items-payload'

export type { PlayItemInput } from './items-payload'

export type PlayItemResult = { error: string } | { ok: true }

export async function playItemAction(
  gpId:     string,
  leagueId: string,
  input:    PlayItemInput,
): Promise<PlayItemResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const season = getCurrentSeason()

  // GP valide et appartient à la saison courante
  const { data: gp } = await supabase
    .from('grands_prix')
    .select('id, season, is_cancelled')
    .eq('id', gpId)
    .single()

  if (!gp)                       return { error: 'GP introuvable' }
  if (gp.season !== season)      return { error: 'GP hors saison courante' }
  if (gp.is_cancelled)           return { error: 'GP annulé' }

  // Deadline : avant la première session de ce GP
  const { data: sessions } = await supabase
    .from('sessions')
    .select('starts_at')
    .eq('gp_id', gpId)
    .order('starts_at', { ascending: true })
    .limit(1)

  const firstSession = sessions?.[0]
  if (!firstSession) return { error: 'Aucune session trouvée pour ce GP' }
  if (new Date(firstSession.starts_at as string) <= new Date()) {
    return { error: 'Deadline passée — items verrouillés pour ce GP' }
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

  // 1 item par GP par ligue par utilisateur
  const { data: alreadyPlayed } = await supabase
    .from('items_played')
    .select('id')
    .eq('user_id', user.id)
    .eq('gp_id', gpId)
    .eq('league_id', leagueId)
    .maybeSingle()

  if (alreadyPlayed) return { error: 'Tu as déjà joué un item ce week-end dans cette ligue' }

  // uses_remaining > 0
  const { data: itemRow } = await supabase
    .from('user_items')
    .select('uses_remaining')
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('item_type', input.itemType)
    .maybeSingle()

  if (!itemRow || (itemRow.uses_remaining as number) <= 0) {
    return { error: 'Item épuisé pour cette saison' }
  }

  // Validations payload selon le type
  const validationError = validatePayload(input)
  if (validationError) return { error: validationError }

  // Pour les items offensifs : la cible doit être un autre membre de la ligue
  if (OFFENSIVE_ITEMS.has(input.itemType)) {
    const offensivePayload = input.payload as BlockDriverPayload | WildCardPayload
    if (offensivePayload.targetUserId === user.id) {
      return { error: 'Tu ne peux pas te cibler toi-même' }
    }
    const { data: targetMember } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId)
      .eq('user_id', offensivePayload.targetUserId)
      .eq('season', season)
      .maybeSingle()

    if (!targetMember) return { error: 'La cible n\'est pas membre de cette ligue' }
  }

  // Conversion payload TS (camelCase) → DB (snake_case)
  const dbPayload = toDBPayload(input)

  try {
    await insertPlayedItem(user.id, leagueId, gpId, season, input.itemType, dbPayload)
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }
}
