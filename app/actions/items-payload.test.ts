import { describe, it, expect } from 'vitest'
import { validatePayload, toDBPayload, type PlayItemInput } from './items-payload'

// ============================================================
// validatePayload
// ============================================================

describe('validatePayload', () => {
  it('accepte un shield (payload vide)', () => {
    expect(validatePayload({ itemType: 'shield', payload: {} })).toBeNull()
  })

  describe('block_driver', () => {
    it('accepte un payload complet', () => {
      expect(validatePayload({
        itemType: 'block_driver',
        payload: { targetUserId: 'u2', sessionType: 'race', driverCode: 'VER' },
      })).toBeNull()
    })

    it('refuse une cible manquante', () => {
      expect(validatePayload({
        itemType: 'block_driver',
        payload: { targetUserId: '', sessionType: 'race', driverCode: 'VER' },
      })).toBe('Cible requise')
    })

    it('refuse un pilote manquant', () => {
      expect(validatePayload({
        itemType: 'block_driver',
        payload: { targetUserId: 'u2', sessionType: 'race', driverCode: '' },
      })).toBe('Pilote requis')
    })

    it('refuse une session invalide', () => {
      expect(validatePayload({
        itemType: 'block_driver',
        payload: { targetUserId: 'u2', sessionType: 'practice', driverCode: 'VER' },
      })).toBe('Session invalide')
    })
  })

  describe('wild_card', () => {
    it('accepte un payload complet', () => {
      expect(validatePayload({
        itemType: 'wild_card',
        payload: { targetUserId: 'u2', sessionType: 'qualifying' },
      })).toBeNull()
    })

    it('refuse une cible manquante', () => {
      expect(validatePayload({
        itemType: 'wild_card',
        payload: { targetUserId: '', sessionType: 'qualifying' },
      })).toBe('Cible requise')
    })

    it('refuse une session invalide', () => {
      expect(validatePayload({
        itemType: 'wild_card',
        payload: { targetUserId: 'u2', sessionType: 'fp1' },
      })).toBe('Session invalide')
    })
  })

  describe('double_points', () => {
    it('accepte une session valide', () => {
      expect(validatePayload({
        itemType: 'double_points',
        payload: { sessionType: 'sprint_race' },
      })).toBeNull()
    })

    it('refuse une session invalide', () => {
      expect(validatePayload({
        itemType: 'double_points',
        payload: { sessionType: '' },
      })).toBe('Session invalide')
    })
  })

  describe('dnf_prediction / underdog_top5', () => {
    it('accepte un pilote', () => {
      expect(validatePayload({ itemType: 'dnf_prediction', payload: { driverCode: 'HAM' } })).toBeNull()
      expect(validatePayload({ itemType: 'underdog_top5', payload: { driverCode: 'OCO' } })).toBeNull()
    })

    it('refuse un pilote manquant', () => {
      expect(validatePayload({ itemType: 'dnf_prediction', payload: { driverCode: '' } })).toBe('Pilote requis')
      expect(validatePayload({ itemType: 'underdog_top5', payload: { driverCode: '' } })).toBe('Pilote requis')
    })
  })

  describe('no_points_team', () => {
    it('accepte une écurie', () => {
      expect(validatePayload({ itemType: 'no_points_team', payload: { constructorCode: 'ferrari' } })).toBeNull()
    })

    it('refuse une écurie manquante', () => {
      expect(validatePayload({ itemType: 'no_points_team', payload: { constructorCode: '' } })).toBe('Écurie requise')
    })
  })

  it('accepte les 4 types de session', () => {
    for (const sessionType of ['qualifying', 'race', 'sprint_qualifying', 'sprint_race']) {
      expect(validatePayload({ itemType: 'double_points', payload: { sessionType } })).toBeNull()
    }
  })
})

// ============================================================
// toDBPayload — mapping camelCase → snake_case
// ============================================================

describe('toDBPayload', () => {
  it('shield → objet vide', () => {
    expect(toDBPayload({ itemType: 'shield', payload: {} })).toEqual({})
  })

  it('block_driver → target_user_id / session_type / driver_code', () => {
    expect(toDBPayload({
      itemType: 'block_driver',
      payload: { targetUserId: 'u2', sessionType: 'race', driverCode: 'VER' },
    })).toEqual({ target_user_id: 'u2', session_type: 'race', driver_code: 'VER' })
  })

  it('wild_card → target_user_id / session_type (sans driver)', () => {
    expect(toDBPayload({
      itemType: 'wild_card',
      payload: { targetUserId: 'u2', sessionType: 'qualifying' },
    })).toEqual({ target_user_id: 'u2', session_type: 'qualifying' })
  })

  it('double_points → session_type', () => {
    expect(toDBPayload({ itemType: 'double_points', payload: { sessionType: 'sprint_race' } }))
      .toEqual({ session_type: 'sprint_race' })
  })

  it('dnf_prediction / underdog_top5 → driver_code', () => {
    expect(toDBPayload({ itemType: 'dnf_prediction', payload: { driverCode: 'HAM' } }))
      .toEqual({ driver_code: 'HAM' })
    expect(toDBPayload({ itemType: 'underdog_top5', payload: { driverCode: 'OCO' } }))
      .toEqual({ driver_code: 'OCO' })
  })

  it('no_points_team → constructor_code', () => {
    expect(toDBPayload({ itemType: 'no_points_team', payload: { constructorCode: 'ferrari' } }))
      .toEqual({ constructor_code: 'ferrari' })
  })

  it('ne laisse jamais fuir un champ camelCase', () => {
    const inputs: PlayItemInput[] = [
      { itemType: 'block_driver', payload: { targetUserId: 'u2', sessionType: 'race', driverCode: 'VER' } },
      { itemType: 'wild_card', payload: { targetUserId: 'u2', sessionType: 'race' } },
      { itemType: 'double_points', payload: { sessionType: 'race' } },
    ]
    for (const input of inputs) {
      const keys = Object.keys(toDBPayload(input))
      expect(keys.every((k) => !/[A-Z]/.test(k))).toBe(true)
    }
  })
})
