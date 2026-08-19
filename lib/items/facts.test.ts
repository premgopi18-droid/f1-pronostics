import { describe, it, expect } from 'vitest'
import { buildGPFacts, type ResolvedItem, type PlayerIdentity } from './facts'

const identity = new Map<string, PlayerIdentity>([
  ['alice', { pseudo: 'Alice', color: '#e10600' }],
])

function makeResolvedItem(overrides: Partial<ResolvedItem>): ResolvedItem {
  return {
    userId:            'alice',
    itemType:          'no_points_team',
    payload:           {},
    wasShielded:       false,
    pointsDeltaActor:  0,
    pointsDeltaTarget: null,
    ...overrides,
  }
}

// #205 — le verdict repose sur le duo réellement en piste : la chaîne doit
// nommer l'écurie sur laquelle l'item a été évalué.
describe('buildGPFacts — no_points_team', () => {
  it('bonus appliqué : la chaîne nomme l\'écurie et le gain', () => {
    const facts = buildGPFacts(
      [makeResolvedItem({ payload: { constructor_code: 'RED_BULL' }, pointsDeltaActor: 12 })],
      identity,
      new Map(),
    )

    expect(facts).toHaveLength(1)
    expect(facts[0].deltaText).toBe('+12')
    expect(facts[0].chain[0]).toContain('RED_BULL')
    expect(facts[0].chain[0]).toContain('12')
  })

  it('sans effet : la chaîne nomme l\'écurie qui a marqué', () => {
    const facts = buildGPFacts(
      [makeResolvedItem({ payload: { constructor_code: 'FERRARI' }, pointsDeltaActor: 0 })],
      identity,
      new Map(),
    )

    expect(facts[0].deltaText).toBeUndefined()
    expect(facts[0].chain[0]).toContain('FERRARI')
  })
})
