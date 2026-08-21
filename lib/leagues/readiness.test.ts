import { describe, expect, it } from 'vitest'
import { buildReadinessRows, readinessLightState } from './readiness'
import type { ReadinessMember, ReadinessSession } from './readiness'

const NOW = new Date('2026-08-22T12:00:00Z').getTime()
const PAST_SESSION = '2026-08-21T14:30:00Z'
const FUTURE_SESSION = '2026-08-23T13:00:00Z'

describe('readinessLightState', () => {
  it('submitted dès qu un prono valide existe, session ouverte ou non', () => {
    expect(readinessLightState(NOW, FUTURE_SESSION, true)).toBe('submitted')
    expect(readinessLightState(NOW, PAST_SESSION, true)).toBe('submitted')
  })

  it('missing sans prono tant que la session n a pas commencé', () => {
    expect(readinessLightState(NOW, FUTURE_SESSION, false)).toBe('missing')
  })

  it('missed sans prono une fois la session commencée', () => {
    expect(readinessLightState(NOW, PAST_SESSION, false)).toBe('missed')
  })

  it('le départ exact verrouille (starts_at == now)', () => {
    expect(readinessLightState(NOW, new Date(NOW).toISOString(), false)).toBe('missed')
  })
})

describe('buildReadinessRows', () => {
  const members: ReadinessMember[] = [
    { userId: 'user-a', pseudo: 'Alice', avatarKey: 'red', avatarUrl: null },
    { userId: 'user-b', pseudo: 'Bob', avatarKey: null, avatarUrl: null },
  ]
  const sessions: ReadinessSession[] = [
    { id: 'session-locked', type: 'sprint_qualifying', startsAt: PAST_SESSION },
    { id: 'session-open', type: 'race', startsAt: FUTURE_SESSION },
  ]

  it('croise membres × sessions dans l ordre, avec les trois états', () => {
    const submittedBySession = new Map([
      ['session-locked', new Set(['user-a'])],
      ['session-open', new Set<string>()],
    ])

    const rows = buildReadinessRows(members, sessions, submittedBySession, NOW)

    expect(rows).toHaveLength(2)
    expect(rows[0].member.userId).toBe('user-a')
    expect(rows[0].lights).toEqual(['submitted', 'missing'])
    expect(rows[1].lights).toEqual(['missed', 'missing'])
  })

  it('une session absente de la map = personne n a soumis', () => {
    const rows = buildReadinessRows(members, sessions, new Map(), NOW)
    expect(rows[0].lights).toEqual(['missed', 'missing'])
  })
})
