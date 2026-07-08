import { createServiceClient } from '@/lib/supabase'
import type { ItemPayload, PlayedItem, SessionType } from '@/lib/scoring/types'

// ── Mapper DB (snake_case) → TypeScript (camelCase) ──────────────────────

function mapPayload(itemType: string, raw: Record<string, unknown>): ItemPayload {
  switch (itemType) {
    case 'shield':
      return { type: 'shield' }
    case 'block_driver':
      return {
        type:         'block_driver',
        targetUserId: raw.target_user_id as string,
        sessionType:  raw.session_type as SessionType,
        driverCode:   raw.driver_code as string,
      }
    case 'wild_card':
      return {
        type:          'wild_card',
        targetUserId:  raw.target_user_id as string,
        sessionType:   raw.session_type as SessionType,
        pointsStolen:  raw.points_stolen as number | undefined,
      }
    case 'double_points':
      return { type: 'double_points', sessionType: raw.session_type as SessionType }
    case 'dnf_prediction':
      return { type: 'dnf_prediction', driverCode: raw.driver_code as string }
    case 'underdog_top5':
      return { type: 'underdog_top5', driverCode: raw.driver_code as string }
    case 'no_points_team':
      return { type: 'no_points_team', constructorCode: raw.constructor_code as string }
    case 'fia_penalty':
      return { type: 'fia_penalty', driverCode: raw.driver_code as string }
    case 'wdc_move':
      return {
        type:         'wdc_move',
        code:         raw.code as string,
        fromPosition: raw.from_position as number,
        toPosition:   raw.to_position as number,
      }
    case 'wcc_move':
      return {
        type:         'wcc_move',
        code:         raw.code as string,
        fromPosition: raw.from_position as number,
        toPosition:   raw.to_position as number,
      }
    default:
      throw new Error(`Type d'item inconnu : ${itemType}`)
  }
}

// ── Lecture ───────────────────────────────────────────────────────────────

export async function getItemsForGP(
  gpId: string,
  leagueId: string,
): Promise<PlayedItem[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('items_played')
    .select('id, user_id, item_type, payload, was_shielded, effect_applied')
    .eq('gp_id', gpId)
    .eq('league_id', leagueId)
    // Spec scoring §3.1 (COLLECTE) — n'inclure que les items pas encore résolus,
    // sinon une relance de la Phase 2 ré-appliquerait des effets déjà comptés.
    .is('resolved_at', null)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id:                row.id as string,
    userId:            row.user_id as string,
    payload:           mapPayload(row.item_type as string, row.payload as Record<string, unknown>),
    wasShielded:       (row.was_shielded as boolean | null) ?? false,
    effectApplied:     (row.effect_applied as boolean | null) ?? false,
    // 0 par défaut : un item non touché par un resolver (bouclier, item annulé)
    // reste à 0/0. Les resolvers écrasent ces valeurs avant markItemsResolved.
    pointsDeltaActor:  0,
    pointsDeltaTarget: 0,
  }))
}

// ── Lecture UI ────────────────────────────────────────────────────────────

export type UserItemRow = {
  itemType:      string
  usesRemaining: number
}

export async function getUserGPItems(
  userId:   string,
  leagueId: string,
  season:   number,
): Promise<UserItemRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_items')
    .select('item_type, uses_remaining')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('season', season)
    // Items saison (wdc_move, wcc_move) traités dans un slice séparé
    .not('item_type', 'in', '(wdc_move,wcc_move)')

  if (error) throw error
  return (data ?? []).map((row) => ({
    itemType:      row.item_type as string,
    usesRemaining: row.uses_remaining as number,
  }))
}

// Item joué par cet utilisateur sur ce GP dans cette ligue (1 max par règle)
export async function getPlayedGPItemForUser(
  userId:   string,
  gpId:     string,
  leagueId: string,
): Promise<{ itemType: string; payload: Record<string, unknown> } | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('items_played')
    .select('item_type, payload')
    .eq('user_id', userId)
    .eq('gp_id', gpId)
    .eq('league_id', leagueId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    itemType: data.item_type as string,
    payload:  data.payload as Record<string, unknown>,
  }
}

// ── Écriture UI ───────────────────────────────────────────────────────────

export async function insertPlayedItem(
  userId:    string,
  leagueId:  string,
  gpId:      string,
  season:    number,
  itemType:  string,
  dbPayload: Record<string, string>,
): Promise<void> {
  const supabase = createServiceClient()

  // Transactionnel : décrément gardé (uses_remaining > 0) + insert items_played en
  // une seule transaction côté Postgres (cf. migration play_item). Évite l'échec
  // partiel (item joué mais usage non décrémenté) et la sur-dépense concurrente.
  const { error } = await supabase.rpc('play_item', {
    p_user_id:   userId,
    p_league_id: leagueId,
    p_gp_id:     gpId,
    p_season:    season,
    p_item_type: itemType,
    p_payload:   dbPayload,
  })
  if (error) throw error
}

// ── Écriture (cron) ───────────────────────────────────────────────────────

// Appelé après applyItemEffects — persiste was_shielded, effect_applied,
// resolved_at, et points_stolen pour les Wild Cards.
export async function markItemsResolved(items: PlayedItem[]): Promise<void> {
  const supabase = createServiceClient()

  await Promise.all(
    items.map(async (item) => {
      // Reconstructed DB payload (camelCase → snake_case) pour les Wild Cards
      // (points_stolen ajouté par resolveWildCards)
      const payload =
        item.payload.type === 'wild_card' && item.payload.pointsStolen !== undefined
          ? {
              target_user_id: item.payload.targetUserId,
              session_type:   item.payload.sessionType,
              points_stolen:  item.payload.pointsStolen,
            }
          : undefined

      const { error } = await supabase
        .from('items_played')
        .update({
          was_shielded:        item.wasShielded,
          effect_applied:      item.effectApplied,
          points_delta_actor:  item.pointsDeltaActor,
          points_delta_target: item.pointsDeltaTarget,
          resolved_at:         new Date().toISOString(),
          ...(payload ? { payload } : {}),
        })
        .eq('id', item.id)
      if (error) throw error
    }),
  )
}
