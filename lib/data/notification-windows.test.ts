import { describe, it, expect } from 'vitest'
import {
  selectSessionsToNudge,
  selectGPsToRemind,
  POST_SESSION_NUDGE_DELAY_MS,
  QUAL_REMINDER_WINDOW_MS,
  type NudgeSessionRow,
  type QualReminderRow,
} from './notification-windows'

const NOW = new Date('2025-03-15T12:00:00Z')

function nudgeRow(overrides: Partial<NudgeSessionRow>): NudgeSessionRow {
  return {
    id:          'sess',
    type:        'qualifying',
    gpId:        'gp1',
    gpName:      'GP Test',
    isCancelled: false,
    startsAt:    NOW,
    notified:    false,
    ...overrides,
  }
}

function reminderRow(overrides: Partial<QualReminderRow>): QualReminderRow {
  return {
    gpId:        'gp1',
    gpName:      'GP Test',
    isCancelled: false,
    notified:    false,
    startsAt:    NOW,
    ...overrides,
  }
}

const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000)

describe('selectSessionsToNudge', () => {
  it('nudge ≥ 2h après le début, vers la session suivante non démarrée', () => {
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'qual', type: 'qualifying', startsAt: hoursFromNow(-3) }),
        nudgeRow({ id: 'race', type: 'race',       startsAt: hoursFromNow(20) }),
      ],
      NOW,
    )
    expect(result).toEqual([{ id: 'qual', nextType: 'race', gpId: 'gp1', gpName: 'GP Test' }])
  })

  it('ne nudge pas avant 2h (borne stricte)', () => {
    const justUnder = new Date(NOW.getTime() - POST_SESSION_NUDGE_DELAY_MS + 1000)
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'qual', startsAt: justUnder }),
        nudgeRow({ id: 'race', type: 'race', startsAt: hoursFromNow(20) }),
      ],
      NOW,
    )
    expect(result).toEqual([])
  })

  it('nudge pile à 2h (borne incluse)', () => {
    const exactly = new Date(NOW.getTime() - POST_SESSION_NUDGE_DELAY_MS)
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'qual', startsAt: exactly }),
        nudgeRow({ id: 'race', type: 'race', startsAt: hoursFromNow(20) }),
      ],
      NOW,
    )
    expect(result.map((r) => r.id)).toEqual(['qual'])
  })

  it('ne nudge pas si la session suivante a déjà démarré', () => {
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'qual', startsAt: hoursFromNow(-5) }),
        nudgeRow({ id: 'race', type: 'race', startsAt: hoursFromNow(-1) }),
      ],
      NOW,
    )
    expect(result).toEqual([])
  })

  it('jamais sur la dernière session (course) — pas de suivante', () => {
    const result = selectSessionsToNudge(
      [nudgeRow({ id: 'race', type: 'race', startsAt: hoursFromNow(-3) })],
      NOW,
    )
    expect(result).toEqual([])
  })

  it('ignore sessions déjà nudgées ou GP annulé', () => {
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'qual', startsAt: hoursFromNow(-3), notified: true }),
        nudgeRow({ id: 'race', type: 'race', startsAt: hoursFromNow(20) }),
        nudgeRow({ id: 'sq', gpId: 'gp2', type: 'sprint_qualifying', startsAt: hoursFromNow(-3), isCancelled: true }),
        nudgeRow({ id: 'sr', gpId: 'gp2', type: 'sprint_race', startsAt: hoursFromNow(20), isCancelled: true }),
      ],
      NOW,
    )
    expect(result).toEqual([])
  })

  it('respecte l’ordre des sessions sprint (SQ → SR → Qualif → Course) indépendamment de l’ordre d’entrée', () => {
    // Entrée volontairement mélangée : la fonction doit trier par starts_at.
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'race', type: 'race',              startsAt: hoursFromNow(48) }),
        nudgeRow({ id: 'sq',   type: 'sprint_qualifying', startsAt: hoursFromNow(-3) }),
        nudgeRow({ id: 'qual', type: 'qualifying',        startsAt: hoursFromNow(24) }),
        nudgeRow({ id: 'sr',   type: 'sprint_race',       startsAt: hoursFromNow(12) }),
      ],
      NOW,
    )
    // Seule SQ est ≥ 2h passée ET sa suivante (SR) pas démarrée → nudge vers sprint_race.
    expect(result).toEqual([{ id: 'sq', nextType: 'sprint_race', gpId: 'gp1', gpName: 'GP Test' }])
  })

  it('isole le calcul par GP', () => {
    const result = selectSessionsToNudge(
      [
        nudgeRow({ id: 'g1-qual', gpId: 'gp1', startsAt: hoursFromNow(-3) }),
        nudgeRow({ id: 'g1-race', gpId: 'gp1', type: 'race', startsAt: hoursFromNow(20) }),
        nudgeRow({ id: 'g2-qual', gpId: 'gp2', gpName: 'GP Deux', startsAt: hoursFromNow(-3) }),
        nudgeRow({ id: 'g2-race', gpId: 'gp2', gpName: 'GP Deux', type: 'race', startsAt: hoursFromNow(20) }),
      ],
      NOW,
    )
    expect(result.map((r) => r.id).sort()).toEqual(['g1-qual', 'g2-qual'])
  })
})

describe('selectGPsToRemind', () => {
  it('rappelle un GP dont la 1ʳᵉ session tombe dans les 24h', () => {
    const result = selectGPsToRemind(
      [
        reminderRow({ gpId: 'gp1', startsAt: hoursFromNow(10) }),
        reminderRow({ gpId: 'gp1', startsAt: hoursFromNow(30) }), // session plus tardive ignorée
      ],
      NOW,
    )
    expect(result).toEqual([{ id: 'gp1', name: 'GP Test' }])
  })

  it('utilise la session la plus tôt comme ancre (hors fenêtre si la 1ʳᵉ est > 24h)', () => {
    const result = selectGPsToRemind(
      [
        reminderRow({ gpId: 'gp1', startsAt: hoursFromNow(30) }),
        reminderRow({ gpId: 'gp1', startsAt: hoursFromNow(50) }),
      ],
      NOW,
    )
    expect(result).toEqual([])
  })

  it('borne haute incluse (pile 24h) et basse exclue (déjà démarrée)', () => {
    const atLimit = selectGPsToRemind(
      [reminderRow({ gpId: 'gp1', startsAt: new Date(NOW.getTime() + QUAL_REMINDER_WINDOW_MS) })],
      NOW,
    )
    expect(atLimit.map((r) => r.id)).toEqual(['gp1'])

    const past = selectGPsToRemind(
      [reminderRow({ gpId: 'gp1', startsAt: hoursFromNow(-1) })],
      NOW,
    )
    expect(past).toEqual([])
  })

  it('ignore les GP annulés ou déjà notifiés', () => {
    const result = selectGPsToRemind(
      [
        reminderRow({ gpId: 'gp1', startsAt: hoursFromNow(10), isCancelled: true }),
        reminderRow({ gpId: 'gp2', gpName: 'GP Deux', startsAt: hoursFromNow(10), notified: true }),
      ],
      NOW,
    )
    expect(result).toEqual([])
  })
})
