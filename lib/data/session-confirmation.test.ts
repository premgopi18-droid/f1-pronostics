import { describe, it, expect } from 'vitest'
import {
  shouldDeferSessionConfirmation,
  UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS,
} from './session-confirmation'

describe('shouldDeferSessionConfirmation', () => {
  const startsAt = '2026-08-21T10:30:00Z' // EL1 du GP Pays-Bas 2026
  const duringSession = new Date('2026-08-21T11:00:00Z').getTime()
  const fullField = 22

  it('aucun pilote inconnu → confirmation immédiate', () => {
    expect(shouldDeferSessionConfirmation([], fullField, 'practice_1', startsAt, duringSession)).toBe(false)
  })

  it('pilote inconnu sur des essais libres, fenêtre en cours → report', () => {
    // Cas Tsunoda : présent dans le classement OpenF1 des EL1, pas encore
    // listé par Jolpica — sa ligne serait perdue si la session se confirmait.
    expect(shouldDeferSessionConfirmation(['TSU'], fullField, 'practice_1', startsAt, duringSession)).toBe(true)
  })

  it('session scorée → jamais de report, même avec un pilote inconnu', () => {
    // La confirmation des sessions scorées déclenche scoring et grille de
    // pré-remplissage : elle ne doit jamais attendre. Un pilote filtré y est
    // forcément non pronostiquable — aucun point ne peut être faussé.
    for (const sessionType of ['qualifying', 'race', 'sprint_qualifying', 'sprint_race'] as const) {
      expect(shouldDeferSessionConfirmation(['TSU'], fullField, sessionType, startsAt, duringSession)).toBe(false)
    }
  })

  it('fenêtre de grâce écoulée → on confirme malgré le pilote manquant', () => {
    const afterGrace = new Date(startsAt).getTime() + UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS
    expect(shouldDeferSessionConfirmation(['TSU'], fullField, 'practice_1', startsAt, afterGrace)).toBe(false)
  })

  it('juste avant la fin de la fenêtre → report encore', () => {
    const justBeforeGraceEnd = new Date(startsAt).getTime() + UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS - 1
    expect(shouldDeferSessionConfirmation(['TSU'], fullField, 'practice_1', startsAt, justBeforeGraceEnd)).toBe(true)
  })

  it('toutes les lignes écartées → jamais de confirmation, quel que soit le type de session', () => {
    // Garde-fou (review #213) : confirmer une session vide déclencherait un
    // scoring sur des résultats inexistants — tout le monde marquerait 0.
    const allUnknown = ['AAA', 'BBB']
    for (const sessionType of ['practice_1', 'qualifying', 'race', 'sprint_qualifying', 'sprint_race'] as const) {
      expect(shouldDeferSessionConfirmation(allUnknown, allUnknown.length, sessionType, startsAt, duringSession)).toBe(true)
    }
  })

  it('toutes les lignes écartées → le report survit même à la fenêtre de grâce', () => {
    const allUnknown = ['AAA', 'BBB']
    const longAfterGrace = new Date(startsAt).getTime() + 10 * UNKNOWN_DRIVER_CONFIRMATION_GRACE_MS
    expect(shouldDeferSessionConfirmation(allUnknown, allUnknown.length, 'practice_1', startsAt, longAfterGrace)).toBe(true)
  })
})
