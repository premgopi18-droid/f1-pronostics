import { describe, it, expect } from 'vitest'
import {
  itemDeadline,
  isPhaseLocked,
  selectableSessions,
  gpPlayability,
  itemAvailability,
  type SessionTiming,
} from './availability'
import { ALLOWED_SESSIONS } from '@/app/actions/items-payload'

const T0 = Date.parse('2026-06-01T00:00:00Z')
const h = (n: number) => T0 + n * 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()

// Week-end normal : qualifs à h(10), course à h(30).
const NORMAL: SessionTiming[] = [
  { type: 'qualifying', startsAt: iso(h(10)) },
  { type: 'race',       startsAt: iso(h(30)) },
]

// Week-end sprint : SQ (vendredi) → SR → qualifs → course.
const SPRINT: SessionTiming[] = [
  { type: 'sprint_qualifying', startsAt: iso(h(0)) },
  { type: 'sprint_race',       startsAt: iso(h(20)) },
  { type: 'qualifying',        startsAt: iso(h(25)) },
  { type: 'race',              startsAt: iso(h(45)) },
]

describe('itemDeadline', () => {
  it('pre_qualifying = début de la 1ʳᵉ session scorée (week-end normal → qualifs)', () => {
    expect(itemDeadline('pre_qualifying', NORMAL)?.getTime()).toBe(h(10))
  })

  it('pre_qualifying en week-end sprint = début de la Sprint Qualifying', () => {
    expect(itemDeadline('pre_qualifying', SPRINT)?.getTime()).toBe(h(0))
  })

  it('pre_race = départ de la course principale, jamais la sprint race', () => {
    expect(itemDeadline('pre_race', SPRINT)?.getTime()).toBe(h(45))
    expect(itemDeadline('pre_race', NORMAL)?.getTime()).toBe(h(30))
  })

  it('null si aucune session scorée', () => {
    expect(itemDeadline('pre_qualifying', [])).toBeNull()
  })

  it('ignore les sessions non scorées éventuelles', () => {
    const withPractice = [
      { type: 'practice_1' as unknown as SessionTiming['type'], startsAt: iso(h(5)) },
      ...NORMAL,
    ]
    expect(itemDeadline('pre_qualifying', withPractice)?.getTime()).toBe(h(10))
  })
})

describe('isPhaseLocked', () => {
  it('non verrouillé avant la deadline', () => {
    expect(isPhaseLocked('pre_qualifying', NORMAL, h(9))).toBe(false)
  })

  it('verrouillé au moment exact de la deadline', () => {
    expect(isPhaseLocked('pre_qualifying', NORMAL, h(10))).toBe(true)
  })

  it('pre_race reste ouvert après les qualifs, verrouille au départ', () => {
    expect(isPhaseLocked('pre_race', NORMAL, h(20))).toBe(false) // entre qualifs et course
    expect(isPhaseLocked('pre_race', NORMAL, h(30))).toBe(true)
  })
})

describe('selectableSessions', () => {
  it('ne garde que les sessions futures autorisées pour block_driver', () => {
    // Dimanche matin : SQ/SR/qualifs passées → seule la course reste.
    const result = selectableSessions(ALLOWED_SESSIONS.block_driver, SPRINT, h(26))
    expect(result).toEqual(['race'])
  })

  it('block_driver le vendredi : toutes les sessions à venir', () => {
    const result = selectableSessions(ALLOWED_SESSIONS.block_driver, SPRINT, h(-1))
    expect(result).toEqual(['sprint_qualifying', 'sprint_race', 'qualifying', 'race'])
  })

  it('wild_card limité à qualif + course, futures uniquement', () => {
    expect(selectableSessions(ALLOWED_SESSIONS.wild_card, NORMAL, h(0))).toEqual(['qualifying', 'race'])
    expect(selectableSessions(ALLOWED_SESSIONS.wild_card, NORMAL, h(15))).toEqual(['race'])
  })
})

describe('gpPlayability', () => {
  it('open quand c\'est le GP courant', () => {
    expect(gpPlayability(5, 5)).toBe('open')
  })

  it('future quand le round est supérieur au GP courant', () => {
    expect(gpPlayability(6, 5)).toBe('future')
  })

  it('past quand le round est inférieur', () => {
    expect(gpPlayability(4, 5)).toBe('past')
  })

  it('past quand il n\'y a plus de GP courant (fin de saison)', () => {
    expect(gpPlayability(5, null)).toBe('past')
  })
})

describe('itemAvailability', () => {
  const base = {
    phase:                'pre_race' as const,
    sessions:             NORMAL,
    nowMs:                h(0),
    hasPlayedThisWeekend: false,
    usesRemaining:        1,
  }

  it('disponible : slot libre, stock ok, palier ouvert', () => {
    expect(itemAvailability(base)).toEqual({ available: true })
  })

  it('slot hebdo pris est prioritaire sur tout le reste', () => {
    expect(
      itemAvailability({ ...base, hasPlayedThisWeekend: true, usesRemaining: 0 }),
    ).toEqual({ available: false, reason: 'weekly_slot_taken' })
  })

  it('stock épuisé quand le slot est libre', () => {
    expect(itemAvailability({ ...base, usesRemaining: 0 })).toEqual({
      available: false,
      reason:    'exhausted',
    })
  })

  it('palier verrouillé après la deadline', () => {
    expect(itemAvailability({ ...base, nowMs: h(30) })).toEqual({
      available: false,
      reason:    'phase_locked',
    })
  })

  it('pre_qualifying verrouillé pendant que pre_race reste ouvert (même instant)', () => {
    const mid = h(20) // après qualifs, avant course
    expect(itemAvailability({ ...base, phase: 'pre_qualifying', nowMs: mid }).available).toBe(false)
    expect(itemAvailability({ ...base, phase: 'pre_race', nowMs: mid }).available).toBe(true)
  })
})
