import type { PlayedItem } from '@/lib/scoring/types'

// Construction des lignes JSONB envoyées à la RPC `mark_items_resolved` (#206)
// — logique pure extraite de lib/data/items.ts pour être testée en isolation.

export interface ItemResolutionRow {
  id:                  string
  was_shielded:        boolean
  effect_applied:      boolean
  points_delta_actor:  number
  points_delta_target: number | null
  /** Remplace le payload DB seulement si non null (Wild Card : points_stolen
   *  ajouté par resolveWildCards) — la RPC fait `coalesce(r.payload, ip.payload)`. */
  payload:             Record<string, string | number> | null
}

export function buildItemResolutionRows(items: PlayedItem[]): ItemResolutionRow[] {
  return items.map((item) => ({
    id:                  item.id,
    was_shielded:        item.wasShielded,
    effect_applied:      item.effectApplied,
    points_delta_actor:  item.pointsDeltaActor,
    points_delta_target: item.pointsDeltaTarget,
    payload:
      item.payload.type === 'wild_card' && item.payload.pointsStolen !== undefined
        ? {
            target_user_id: item.payload.targetUserId,
            session_type:   item.payload.sessionType,
            points_stolen:  item.payload.pointsStolen,
          }
        : null,
  }))
}
