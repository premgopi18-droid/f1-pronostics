import { describe, it, expect } from 'vitest'
import { applyItemEffects, resolveShields, resolveWildCards } from './resolve-items'
import type { BreakdownEntry, DriverResult, PlayedItem, ResolutionContext, ScoreKey, SessionScore } from './types'

// ============================================================
// Helpers
// ============================================================

function makeScore(
  finalScore: number,
  exactPositions = 0,
  breakdown: BreakdownEntry[] = [],
): SessionScore {
  return { baseScore: finalScore, finalScore, exactPositions, breakdown }
}

function makeEntry(code: string, predictedPos: number, actualPos: number | null, pts: number): BreakdownEntry {
  return { code, predictedPos, actualPos, pts }
}

function makeItem(
  overrides: Partial<PlayedItem> & Pick<PlayedItem, 'userId' | 'type' | 'payload'>,
): PlayedItem {
  return {
    id:            'test-item',
    wasShielded:   false,
    effectApplied: false,
    ...overrides,
  }
}

const emptyCtx: ResolutionContext = {
  raceResults:        new Map(),
  qualifyingResults:  new Map(),
  constructorDrivers: new Map(),
  leagueId:           'league-1',
  gpId:               'gp-monaco',
}

// ============================================================
// Exemple complet Monaco — scoring-spec §6
// ============================================================

describe('Monaco §6 — exemple intégration complet', () => {
  it('Bob vole 11 pts à Alice, Alice double → alice=22, bob=55', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(22, 1)],
      ['bob:race',   makeScore(44, 8)],
    ])
    const items: PlayedItem[] = [
      makeItem({ id: 'wc1', userId: 'bob',   type: 'wild_card',     payload: { type: 'wild_card',    targetUserId: 'alice', sessionType: 'race' } }),
      makeItem({ id: 'db1', userId: 'alice', type: 'double_points', payload: { type: 'double_points', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(22)
    expect(scores.get('bob:race')!.finalScore).toBe(55)

    const wcItem = items.find(i => i.type === 'wild_card')!
    expect((wcItem.payload as any).pointsStolen).toBe(11)
    expect(wcItem.effectApplied).toBe(true)
    expect(items.find(i => i.type === 'double_points')!.effectApplied).toBe(true)
  })
})

// ============================================================
// Bouclier
// ============================================================

describe('Bouclier', () => {
  it('shield annule un wild_card entrant', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20)],
      ['bob:race',   makeScore(40)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'shield',    payload: { type: 'shield' } }),
      makeItem({ userId: 'bob',   type: 'wild_card', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    // Wild Card annulé — scores inchangés
    expect(scores.get('alice:race')!.finalScore).toBe(20)
    expect(scores.get('bob:race')!.finalScore).toBe(40)
    expect(items.find(i => i.type === 'wild_card')!.wasShielded).toBe(true)
    expect(items.find(i => i.type === 'wild_card')!.effectApplied).toBe(false)
  })

  it('shield annule un block_driver entrant', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [makeEntry('VER', 1, 1, 5)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'shield',       payload: { type: 'shield' } }),
      makeItem({ userId: 'bob',   type: 'block_driver', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(20) // VER non bloqué
    expect(items.find(i => i.type === 'block_driver')!.wasShielded).toBe(true)
  })
})

// ============================================================
// Block driver
// ============================================================

describe('Block driver', () => {
  it('retire les points de position du pilote ciblé', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [
        makeEntry('VER', 1, 1, 5),
        makeEntry('NOR', 2, 3, 2),
      ])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', type: 'block_driver', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(15) // 20 - 5
    expect(items[0].effectApplied).toBe(true)
  })

  it('block sur pilote DNF/0 pt → effectApplied false, score inchangé', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(10, 0, [
        makeEntry('PER', 2, null, 0), // DNF → 0 pts
      ])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', type: 'block_driver', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'PER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(10) // inchangé
    expect(items[0].effectApplied).toBe(false)
  })

  it('block ne touche pas le bonus FL (non dans breakdown)', () => {
    // Alice a 22 pts : 21 positions + 1 FL bonus
    // NOR est dans le breakdown avec 2 pts (position)
    // Bob bloque NOR → retire 2 pts de position, le +1 FL survit
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(22, 1, [
        makeEntry('VER', 1, 1, 5),
        makeEntry('NOR', 4, 3, 2), // 2 pts de position pour NOR
        // +1 FL bonus intégré dans finalScore mais pas dans breakdown
      ])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', type: 'block_driver', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'NOR' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(20) // 22 - 2 (FL +1 survit)
  })

  it('exact_positions inchangé après un block', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 3, [makeEntry('VER', 1, 1, 5)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', type: 'block_driver', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.exactPositions).toBe(3) // inchangé
    expect(scores.get('alice:race')!.finalScore).toBe(15)
  })
})

// ============================================================
// Wild Card
// ============================================================

describe('Wild Card', () => {
  it('transfère floor(score/2) : 22 → vol de 11', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(22)],
      ['bob:race',   makeScore(10)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', type: 'wild_card', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(11) // 22 - 11
    expect(scores.get('bob:race')!.finalScore).toBe(21)   // 10 + 11
  })

  it('Wild Card sur 0 pt → stolen=0, effectApplied=true', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(0)],
      ['bob:race',   makeScore(30)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', type: 'wild_card', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(0)
    expect(scores.get('bob:race')!.finalScore).toBe(30)
    expect((items[0].payload as any).pointsStolen).toBe(0)
    expect(items[0].effectApplied).toBe(true)
  })

  it('Wild Cards mutuels (A→B et B→A) — résolution sur snapshot, pas en cascade', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20)],
      ['bob:race',   makeScore(30)],
    ])
    const items: PlayedItem[] = [
      makeItem({ id: 'wc-ab', userId: 'alice', type: 'wild_card', payload: { type: 'wild_card', targetUserId: 'bob',   sessionType: 'race' } }),
      makeItem({ id: 'wc-ba', userId: 'bob',   type: 'wild_card', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    resolveWildCards(items, scores)

    // Snapshot: alice=20, bob=30
    // alice vole floor(30/2)=15 à bob
    // bob vole floor(20/2)=10 à alice
    expect(scores.get('alice:race')!.finalScore).toBe(20 - 10 + 15) // 25
    expect(scores.get('bob:race')!.finalScore).toBe(30 - 15 + 10)   // 25
  })
})

// ============================================================
// Bonus items
// ============================================================

describe('DNF prediction', () => {
  it('+8 pts si le pilote a dnf=true', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([['ALO', { position: null, fastestLap: false, dnf: true }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'dnf_prediction', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(18)
    expect(items[0].effectApplied).toBe(true)
  })

  it('DNS (dnf=false) → item wasted, score inchangé', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([['ALO', { position: null, fastestLap: false, dnf: false }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'dnf_prediction', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(10)
    expect(items[0].effectApplied).toBe(false)
  })
})

describe('Underdog top 5', () => {
  it('+8 pts si qual>10 ET race≤5', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const qualifyingResults = new Map<string, DriverResult>([['GAS', { position: 15, fastestLap: false }]])
    const raceResults       = new Map<string, DriverResult>([['GAS', { position: 4,  fastestLap: false }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'underdog_top5', payload: { type: 'underdog_top5', driverCode: 'GAS' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, qualifyingResults, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(18)
    expect(items[0].effectApplied).toBe(true)
  })

  it('DNS qualif (position null) → éligible par défaut', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const qualifyingResults = new Map<string, DriverResult>([['GAS', { position: null, fastestLap: false }]])
    const raceResults       = new Map<string, DriverResult>([['GAS', { position: 3,   fastestLap: false }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'underdog_top5', payload: { type: 'underdog_top5', driverCode: 'GAS' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, qualifyingResults, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(18)
  })

  it('pas de bonus si qual≤10 (pas un underdog)', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const qualifyingResults = new Map<string, DriverResult>([['NOR', { position: 3, fastestLap: false }]])
    const raceResults       = new Map<string, DriverResult>([['NOR', { position: 1, fastestLap: true  }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'underdog_top5', payload: { type: 'underdog_top5', driverCode: 'NOR' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, qualifyingResults, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(10) // inchangé
    expect(items[0].effectApplied).toBe(false)
  })
})

describe('No points team', () => {
  it('+12 pts si aucun des 2 pilotes ne score', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([
      ['MAG', { position: null, fastestLap: false, dnf: true }],
      ['HUL', { position: 14,   fastestLap: false }],
    ])
    const constructorDrivers = new Map([['HAAS', ['MAG', 'HUL']]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'no_points_team', payload: { type: 'no_points_team', constructorCode: 'HAAS' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults, constructorDrivers })

    expect(scores.get('alice:race')!.finalScore).toBe(22)
    expect(items[0].effectApplied).toBe(true)
  })

  it('pas de bonus si un pilote score (position≤10)', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([
      ['MAG', { position: 9,  fastestLap: false }],
      ['HUL', { position: 14, fastestLap: false }],
    ])
    const constructorDrivers = new Map([['HAAS', ['MAG', 'HUL']]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', type: 'no_points_team', payload: { type: 'no_points_team', constructorCode: 'HAAS' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults, constructorDrivers })

    expect(scores.get('alice:race')!.finalScore).toBe(10)
    expect(items[0].effectApplied).toBe(false)
  })
})
