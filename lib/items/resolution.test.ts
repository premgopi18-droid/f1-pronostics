import { describe, it, expect } from 'vitest'
import { buildItemResolutionRows } from './resolution'
import type { PlayedItem } from '@/lib/scoring/types'

function makeItem(overrides: Partial<PlayedItem>): PlayedItem {
  return {
    id:                'item-1',
    userId:            'alice',
    payload:           { type: 'shield' },
    wasShielded:       false,
    effectApplied:     false,
    pointsDeltaActor:  0,
    pointsDeltaTarget: null,
    ...overrides,
  }
}

describe('buildItemResolutionRows (#206)', () => {
  it('mappe les champs de résolution en snake_case, payload null par défaut', () => {
    const rows = buildItemResolutionRows([
      makeItem({
        id:                'item-npt',
        payload:           { type: 'no_points_team', constructorCode: 'RED_BULL' },
        effectApplied:     true,
        pointsDeltaActor:  12,
      }),
    ])

    expect(rows).toEqual([{
      id:                  'item-npt',
      was_shielded:        false,
      effect_applied:      true,
      points_delta_actor:  12,
      points_delta_target: null,
      payload:             null,
    }])
  })

  it('Wild Card résolue : réémet le payload DB avec points_stolen', () => {
    const rows = buildItemResolutionRows([
      makeItem({
        id: 'item-wc',
        payload: { type: 'wild_card', targetUserId: 'bob', sessionType: 'race', pointsStolen: 11 },
        effectApplied:     true,
        pointsDeltaActor:  11,
        pointsDeltaTarget: -11,
      }),
    ])

    expect(rows[0].payload).toEqual({
      target_user_id: 'bob',
      session_type:   'race',
      points_stolen:  11,
    })
    expect(rows[0].points_delta_target).toBe(-11)
  })

  it('Wild Card non résolue (pointsStolen absent — bouclier) : payload null, l\'existant est préservé côté SQL', () => {
    const rows = buildItemResolutionRows([
      makeItem({
        id:          'item-wc-shielded',
        payload:     { type: 'wild_card', targetUserId: 'bob', sessionType: 'race' },
        wasShielded: true,
      }),
    ])

    expect(rows[0].payload).toBeNull()
    expect(rows[0].was_shielded).toBe(true)
  })
})
