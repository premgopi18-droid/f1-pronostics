import { createClient } from '@/lib/supabase'
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('items_played')
    .select('id, user_id, item_type, payload, was_shielded, effect_applied')
    .eq('gp_id', gpId)
    .eq('league_id', leagueId)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id:            row.id as string,
    userId:        row.user_id as string,
    payload:       mapPayload(row.item_type as string, row.payload as Record<string, unknown>),
    wasShielded:   (row.was_shielded as boolean | null) ?? false,
    effectApplied: (row.effect_applied as boolean | null) ?? false,
  }))
}

// ── Écriture ──────────────────────────────────────────────────────────────

// Appelé après applyItemEffects — persiste was_shielded, effect_applied,
// resolved_at, et points_stolen pour les Wild Cards.
export async function markItemsResolved(items: PlayedItem[]): Promise<void> {
  const supabase = await createClient()

  await Promise.all(
    items.map((item) => {
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

      return supabase
        .from('items_played')
        .update({
          was_shielded:   item.wasShielded,
          effect_applied: item.effectApplied,
          resolved_at:    new Date().toISOString(),
          ...(payload ? { payload } : {}),
        })
        .eq('id', item.id)
    }),
  )
}
