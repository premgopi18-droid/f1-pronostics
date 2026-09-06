import { describe, it, expect } from 'vitest'
import {
  hasFastestLap,
  markFastestLap,
  shouldDeferSessionConfirmation,
  RACE_FASTEST_LAP_GRACE_MS,
  UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS,
  type SessionConfirmationInput,
} from './session-confirmation'
import type { DriverResult } from '@/lib/scoring/types'

const result = (fastestLap: boolean): DriverResult => ({ position: 1, fastestLap })

describe('hasFastestLap', () => {
  it('true dès qu\'un pilote du résultat porte le meilleur tour', () => {
    expect(hasFastestLap(new Map([['VER', result(false)], ['ANT', result(true)]]))).toBe(true)
  })

  it('false si aucune ligne ne le porte (publication Jolpica partielle, #239) ou résultat vide', () => {
    expect(hasFastestLap(new Map([['VER', result(false)], ['ANT', result(false)]]))).toBe(false)
    expect(hasFastestLap(new Map())).toBe(false)
  })
})

describe('markFastestLap', () => {
  it('pose le meilleur tour sur le pilote du résultat et renvoie true', () => {
    const results = new Map([['VER', result(false)], ['ANT', result(false)]])
    expect(markFastestLap(results, 'ANT')).toBe(true)
    expect(results.get('ANT')?.fastestLap).toBe(true)
    expect(results.get('VER')?.fastestLap).toBe(false)
  })

  it('pilote absent du résultat → false, rien n\'est modifié (désaccord entre sources à rendre visible)', () => {
    const results = new Map([['VER', result(false)]])
    expect(markFastestLap(results, 'ANT')).toBe(false)
    expect(hasFastestLap(results)).toBe(false)
  })
})

describe('shouldDeferSessionConfirmation', () => {
  const startsAt = '2026-08-21T10:30:00Z' // EL1 du GP Pays-Bas 2026
  const duringSession = new Date('2026-08-21T11:00:00Z').getTime()
  const afterGrace = new Date(startsAt).getTime() + UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS
  const justBeforeGraceEnd = afterGrace - 1
  const fullField = 22

  const baseInput: SessionConfirmationInput = {
    unknownDriverCodes: [],
    resultCount:        fullField,
    sessionType:        'practice_1',
    sessionStartsAt:    startsAt,
    fastestLapKnown:    false,
    now:                duringSession,
  }
  const decide = (overrides: Partial<SessionConfirmationInput>) =>
    shouldDeferSessionConfirmation({ ...baseInput, ...overrides })

  describe('pilotes inconnus (#212)', () => {
    it('aucun pilote inconnu → confirmation immédiate', () => {
      expect(decide({})).toBe(false)
    })

    it('pilote inconnu sur des essais libres, fenêtre en cours → report', () => {
      // Cas Tsunoda : présent dans le classement OpenF1 des EL1, pas encore
      // listé par Jolpica — sa ligne serait perdue si la session se confirmait.
      expect(decide({ unknownDriverCodes: ['TSU'] })).toBe(true)
    })

    it('session scorée → jamais de report pour un pilote inconnu', () => {
      // La confirmation des sessions scorées déclenche scoring et grille de
      // pré-remplissage : elle ne doit pas attendre un pilote filtré, forcément
      // non pronostiquable — aucun point ne peut être faussé.
      for (const sessionType of ['qualifying', 'race', 'sprint_qualifying', 'sprint_race'] as const) {
        expect(decide({ unknownDriverCodes: ['TSU'], sessionType, fastestLapKnown: true })).toBe(false)
      }
    })

    it('fenêtre de grâce écoulée → on confirme malgré le pilote manquant', () => {
      expect(decide({ unknownDriverCodes: ['TSU'], now: afterGrace })).toBe(false)
    })

    it('juste avant la fin de la fenêtre → report encore', () => {
      expect(decide({ unknownDriverCodes: ['TSU'], now: justBeforeGraceEnd })).toBe(true)
    })
  })

  describe('meilleur tour absent sur la course (#239)', () => {
    // Monza 2026 : Jolpica a publié le classement sans le bloc FastestLap, la
    // course a été confirmée avec `fastest_lap = false` sur les 22 lignes et le
    // bonus +7 perdu — sans rattrapage possible une fois le GP finalisé.
    const raceStartsAt = '2026-09-06T13:00:00Z'
    const afterRace = new Date('2026-09-06T16:00:00Z').getTime()
    const race = { sessionType: 'race' as const, sessionStartsAt: raceStartsAt, now: afterRace }

    it('course sans meilleur tour, fenêtre en cours → report', () => {
      expect(decide({ ...race, fastestLapKnown: false })).toBe(true)
    })

    it('course avec meilleur tour → confirmation immédiate', () => {
      expect(decide({ ...race, fastestLapKnown: true })).toBe(false)
    })

    it('fenêtre dédiée (plus courte que #212) écoulée → on confirme sans meilleur tour', () => {
      // Différer la course retient toutes les positions pour un bonus de 7 :
      // on ne tient pas 24 h, on confirme et on logue pour rattrapage manuel.
      const raceAfterGrace = new Date(raceStartsAt).getTime() + RACE_FASTEST_LAP_GRACE_MS
      expect(decide({ ...race, fastestLapKnown: false, now: raceAfterGrace })).toBe(false)
      expect(decide({ ...race, fastestLapKnown: false, now: raceAfterGrace - 1 })).toBe(true)
      expect(RACE_FASTEST_LAP_GRACE_MS).toBeLessThan(UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS)
    })

    it('le signal est ignoré hors course : le bonus meilleur tour n\'existe que sur la course', () => {
      for (const sessionType of ['qualifying', 'sprint_qualifying', 'sprint_race', 'practice_1'] as const) {
        expect(decide({ ...race, sessionType, fastestLapKnown: false })).toBe(false)
      }
    })
  })

  describe('garde-fou absolu (review #213)', () => {
    // Confirmer une session vide déclencherait un scoring sur des résultats
    // inexistants — tout le monde marquerait 0.
    const allUnknown = ['AAA', 'BBB']

    it('toutes les lignes écartées → jamais de confirmation, quel que soit le type de session', () => {
      for (const sessionType of ['practice_1', 'qualifying', 'race', 'sprint_qualifying', 'sprint_race'] as const) {
        expect(decide({ unknownDriverCodes: allUnknown, resultCount: allUnknown.length, sessionType, fastestLapKnown: true })).toBe(true)
      }
    })

    it('toutes les lignes écartées → le report survit même à la fenêtre de grâce', () => {
      const longAfterGrace = new Date(startsAt).getTime() + 10 * UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS
      expect(decide({ unknownDriverCodes: allUnknown, resultCount: allUnknown.length, now: longAfterGrace })).toBe(true)
    })
  })
})
