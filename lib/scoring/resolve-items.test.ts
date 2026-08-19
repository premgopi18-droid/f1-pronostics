import { describe, it, expect } from 'vitest'
import { applyItemEffects, buildConstructorDrivers, resolveWildCards } from './resolve-items'
import type { BreakdownEntry, DriverResult, ItemPayload, PlayedItem, ResolutionContext, ScoreKey, SessionScore } from './types'

type WildCardPayload = Extract<ItemPayload, { type: 'wild_card' }>

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
  overrides: Omit<PlayedItem, 'id' | 'wasShielded' | 'effectApplied' | 'pointsDeltaActor' | 'pointsDeltaTarget'>
    & Partial<Pick<PlayedItem, 'wasShielded' | 'effectApplied' | 'pointsDeltaActor' | 'pointsDeltaTarget'>>,
): PlayedItem {
  return {
    id:                'test-item',
    wasShielded:       false,
    effectApplied:     false,
    pointsDeltaActor:  0,
    pointsDeltaTarget: 0,
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
      makeItem({ userId: 'bob',   payload: { type: 'wild_card',    targetUserId: 'alice', sessionType: 'race' } }),
      makeItem({ userId: 'alice', payload: { type: 'double_points', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(22)
    expect(scores.get('bob:race')!.finalScore).toBe(55)

    const wc = items.find(i => i.payload.type === 'wild_card')!
    expect((wc.payload as WildCardPayload).pointsStolen).toBe(11)
    expect(wc.effectApplied).toBe(true)
    expect(items.find(i => i.payload.type === 'double_points')!.effectApplied).toBe(true)
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
      makeItem({ userId: 'alice', payload: { type: 'shield' } }),
      makeItem({ userId: 'bob',   payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(20)
    expect(scores.get('bob:race')!.finalScore).toBe(40)
    expect(items.find(i => i.payload.type === 'wild_card')!.wasShielded).toBe(true)
    expect(items.find(i => i.payload.type === 'wild_card')!.effectApplied).toBe(false)
  })

  it('shield annule un block_driver entrant', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [makeEntry('VER', 1, 1, 5)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'shield' } }),
      makeItem({ userId: 'bob',   payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(20)
    expect(items.find(i => i.payload.type === 'block_driver')!.wasShielded).toBe(true)
  })

  it('shield protège contre block ET wild_card simultanés', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [makeEntry('VER', 1, 1, 5)])],
      ['bob:race',   makeScore(30)],
      ['carol:race', makeScore(25)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'shield' } }),
      makeItem({ userId: 'bob',   payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
      makeItem({ userId: 'carol', payload: { type: 'wild_card',    targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(20) // aucun item n'a effet
    expect(items.find(i => i.payload.type === 'block_driver')!.wasShielded).toBe(true)
    expect(items.find(i => i.payload.type === 'wild_card')!.wasShielded).toBe(true)
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
      makeItem({ userId: 'bob', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(15)
    expect(items[0].effectApplied).toBe(true)
  })

  it('block sur pilote DNF/0 pt → effectApplied false, score inchangé', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(10, 0, [makeEntry('PER', 2, null, 0)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'PER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(10)
    expect(items[0].effectApplied).toBe(false)
  })

  it('block ne touche pas le bonus FL (non dans breakdown)', () => {
    // 28 pts = 21 position + 7 FL bonus (non dans breakdown)
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(28, 1, [
        makeEntry('VER', 1, 1, 5),
        makeEntry('NOR', 4, 3, 2),
      ])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'NOR' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(26) // 28 - 2 pts NOR, +7 FL survit
  })

  it('exact_positions inchangé après un block', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 3, [makeEntry('VER', 1, 1, 5)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.exactPositions).toBe(3)
    expect(scores.get('alice:race')!.finalScore).toBe(15)
  })

  it('block + wild_card sur la même victime — block appliqué en premier', () => {
    // Alice a 20 pts avec VER=5pts dans breakdown
    // Bob bloque VER → alice passe à 15
    // Carol vole via WC → snapshot=15, steal=floor(15/2)=7 → alice=8, carol=30+7=37
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [makeEntry('VER', 1, 1, 5)])],
      ['bob:race',   makeScore(40)],
      ['carol:race', makeScore(30)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob',   payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
      makeItem({ userId: 'carol', payload: { type: 'wild_card',    targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(8)   // 20 - 5 (block) - 7 (WC)
    expect(scores.get('carol:race')!.finalScore).toBe(37)  // 30 + 7
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
      makeItem({ userId: 'bob', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(11)
    expect(scores.get('bob:race')!.finalScore).toBe(21)
  })

  it('Wild Card sur 0 pt → stolen=0, effectApplied=true', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(0)],
      ['bob:race',   makeScore(30)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(scores.get('alice:race')!.finalScore).toBe(0)
    expect(scores.get('bob:race')!.finalScore).toBe(30)
    expect((items[0].payload as WildCardPayload).pointsStolen).toBe(0)
    expect(items[0].effectApplied).toBe(true)
  })

  it('Wild Cards mutuels — résolution sur snapshot, pas en cascade', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20)],
      ['bob:race',   makeScore(30)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'wild_card', targetUserId: 'bob',   sessionType: 'race' } }),
      makeItem({ userId: 'bob',   payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    resolveWildCards(items, scores)

    // Snapshot: alice=20, bob=30
    // alice vole floor(30/2)=15 à bob
    // bob vole floor(20/2)=10 à alice
    expect(scores.get('alice:race')!.finalScore).toBe(25) // 20 - 10 + 15
    expect(scores.get('bob:race')!.finalScore).toBe(25)   // 30 - 15 + 10
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
      makeItem({ userId: 'alice', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(18)
    expect(items[0].effectApplied).toBe(true)
  })

  it('DNS (dnf=false) → item wasted, score inchangé', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([['ALO', { position: null, fastestLap: false, dnf: false }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
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
      makeItem({ userId: 'alice', payload: { type: 'underdog_top5', driverCode: 'GAS' } }),
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
      makeItem({ userId: 'alice', payload: { type: 'underdog_top5', driverCode: 'GAS' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, qualifyingResults, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(18)
  })

  it('pas de bonus si qual≤10 (pas un underdog)', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const qualifyingResults = new Map<string, DriverResult>([['NOR', { position: 3, fastestLap: false }]])
    const raceResults       = new Map<string, DriverResult>([['NOR', { position: 1, fastestLap: true  }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'underdog_top5', driverCode: 'NOR' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, qualifyingResults, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(10)
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
      makeItem({ userId: 'alice', payload: { type: 'no_points_team', constructorCode: 'HAAS' } }),
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
      makeItem({ userId: 'alice', payload: { type: 'no_points_team', constructorCode: 'HAAS' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults, constructorDrivers })

    expect(scores.get('alice:race')!.finalScore).toBe(10)
    expect(items[0].effectApplied).toBe(false)
  })

  // #205 — écurie absente de la map : condition invérifiable → jamais de bonus par
  // défaut (l'ancien comportement offrait +12 sur un code invalide).
  it('pas de bonus si l\'écurie est introuvable dans la map', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'no_points_team', constructorCode: 'SCUDERIA_TOTO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, constructorDrivers: new Map() })

    expect(scores.get('alice:race')!.finalScore).toBe(10)
    expect(items[0].effectApplied).toBe(false)
    expect(items[0].pointsDeltaActor).toBe(0)
  })

  // #205 — un pilote listé dans le duo mais absent des résultats (forfait) compte
  // comme « sans points » : seul le coéquipier présent peut invalider le bonus.
  it('pilote du duo absent des résultats = sans points', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([
      ['VER', { position: 12, fastestLap: false }],
      // HAD forfait : aucune ligne de résultat
    ])
    const constructorDrivers = new Map([['RED_BULL', ['VER', 'HAD']]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'no_points_team', constructorCode: 'RED_BULL' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults, constructorDrivers })

    expect(scores.get('alice:race')!.finalScore).toBe(22)
    expect(items[0].effectApplied).toBe(true)
  })

  // #205 — scénario échange de baquet : le duo vient des résultats de LA course
  // (buildConstructorDrivers), pas du line-up nominal. Lawson (remplaçant) score
  // pour Red Bull → pas de bonus, même si Hadjar (titulaire absent) n'a pas couru.
  it('échange de baquet : évalué sur le duo réellement en piste', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([
      ['VER', { position: 11, fastestLap: false, constructorCode: 'RED_BULL' }],
      ['LAW', { position: 8,  fastestLap: false, constructorCode: 'RED_BULL' }],
      ['TSU', { position: 13, fastestLap: false, constructorCode: 'RB' }],
    ])
    const constructorDrivers = buildConstructorDrivers(raceResults)
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'no_points_team', constructorCode: 'RED_BULL' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults, constructorDrivers })

    expect(constructorDrivers.get('RED_BULL')).toEqual(['VER', 'LAW'])
    expect(scores.get('alice:race')!.finalScore).toBe(10)
    expect(items[0].effectApplied).toBe(false)
  })
})

// ============================================================
// buildConstructorDrivers (#205) — duo réel depuis les résultats de course
// ============================================================

describe('buildConstructorDrivers', () => {
  it('groupe les pilotes par constructorCode', () => {
    const results = new Map<string, DriverResult>([
      ['VER', { position: 1,  fastestLap: false, constructorCode: 'RED_BULL' }],
      ['LAW', { position: 8,  fastestLap: false, constructorCode: 'RED_BULL' }],
      ['LEC', { position: 2,  fastestLap: false, constructorCode: 'FERRARI' }],
    ])

    const map = buildConstructorDrivers(results)

    expect(map.get('RED_BULL')).toEqual(['VER', 'LAW'])
    expect(map.get('FERRARI')).toEqual(['LEC'])
  })

  it('ignore les résultats sans constructorCode et renvoie une map vide si aucun', () => {
    const withPartial = buildConstructorDrivers(new Map<string, DriverResult>([
      ['VER', { position: 1, fastestLap: false, constructorCode: 'RED_BULL' }],
      ['LEC', { position: 2, fastestLap: false }],
    ]))
    expect(withPartial.size).toBe(1)

    const legacy = buildConstructorDrivers(new Map<string, DriverResult>([
      ['VER', { position: 1, fastestLap: false }],
    ]))
    expect(legacy.size).toBe(0)
  })
})

// ============================================================
// Deltas chiffrés (issue #151) — points_delta_actor / points_delta_target
// ============================================================

describe('Deltas chiffrés', () => {
  it('block_driver : actor 0, target = -points retirés', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [makeEntry('VER', 1, 1, 5)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(items[0].pointsDeltaActor).toBe(0)
    expect(items[0].pointsDeltaTarget).toBe(-5)
  })

  it('block_driver sans points à retirer : actor 0, target 0', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(10, 0, [makeEntry('PER', 2, null, 0)])],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'PER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(items[0].pointsDeltaActor).toBe(0)
    expect(items[0].pointsDeltaTarget).toBe(0)
  })

  it('wild_card : actor +stolen, target -stolen', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(22)],
      ['bob:race',   makeScore(10)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'bob', payload: { type: 'wild_card', targetUserId: 'alice', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(items[0].pointsDeltaActor).toBe(11)
    expect(items[0].pointsDeltaTarget).toBe(-11)
  })

  it('double_points : actor = montant ajouté par le ×2, target null', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(15)]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'double_points', sessionType: 'race' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(items[0].pointsDeltaActor).toBe(15)   // 30 - 15
    expect(items[0].pointsDeltaTarget).toBeNull()
  })

  it('bonus prédiction (dnf) : actor +8, target null', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([['ALO', { position: null, fastestLap: false, dnf: true }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults })

    expect(items[0].pointsDeltaActor).toBe(8)
    expect(items[0].pointsDeltaTarget).toBeNull()
  })

  it('bonus non déclenché : actor 0, target null', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([['ALO', { position: 5, fastestLap: false, dnf: false }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults })

    expect(items[0].pointsDeltaActor).toBe(0)
    expect(items[0].pointsDeltaTarget).toBeNull()
  })

  it('shield : actor 0, target 0', () => {
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(20)]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'shield' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    expect(items[0].pointsDeltaActor).toBe(0)
    expect(items[0].pointsDeltaTarget).toBe(0)
  })

  it('item offensif annulé par bouclier : actor 0, target 0', () => {
    const scores = new Map<ScoreKey, SessionScore>([
      ['alice:race', makeScore(20, 1, [makeEntry('VER', 1, 1, 5)])],
      ['bob:race',   makeScore(40)],
    ])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'shield' } }),
      makeItem({ userId: 'bob',   payload: { type: 'block_driver', targetUserId: 'alice', sessionType: 'race', driverCode: 'VER' } }),
    ]

    applyItemEffects(items, scores, emptyCtx)

    const block = items.find(i => i.payload.type === 'block_driver')!
    expect(block.wasShielded).toBe(true)
    expect(block.pointsDeltaActor).toBe(0)
    expect(block.pointsDeltaTarget).toBe(0)
  })
})

describe('Combos', () => {
  it('double_points + dnf_prediction — bonus non doublé (appliqué après ×2)', () => {
    // Alice a 10 pts, joue double (race) → 20 pts
    // dnf_prediction sur ALO → +8 pts après le ×2 → 28 pts (pas 36)
    const scores = new Map<ScoreKey, SessionScore>([['alice:race', makeScore(10)]])
    const raceResults = new Map<string, DriverResult>([['ALO', { position: null, fastestLap: false, dnf: true }]])
    const items: PlayedItem[] = [
      makeItem({ userId: 'alice', payload: { type: 'double_points',  sessionType: 'race' } }),
      makeItem({ userId: 'alice', payload: { type: 'dnf_prediction', driverCode: 'ALO' } }),
    ]

    applyItemEffects(items, scores, { ...emptyCtx, raceResults })

    expect(scores.get('alice:race')!.finalScore).toBe(28) // (10 × 2) + 8
  })
})
