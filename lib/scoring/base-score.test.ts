import { describe, it, expect } from 'vitest'
import { computeBaseScore, computeFastestLap, computeSessionBaseScore } from './base-score'
import type { DriverResult } from './types'

// Monaco 2026 race results — scoring-spec.md §6
const monacoResults = new Map<string, DriverResult>([
  ['VER', { position: 1,    fastestLap: false }],
  ['LEC', { position: 2,    fastestLap: false }],
  ['NOR', { position: 3,    fastestLap: true  }],
  ['PIA', { position: 4,    fastestLap: false }],
  ['RUS', { position: 5,    fastestLap: false }],
  ['ALO', { position: 6,    fastestLap: false }],
  ['SAI', { position: 7,    fastestLap: false }],
  ['HAM', { position: 8,    fastestLap: false }],
  ['STR', { position: 9,    fastestLap: false }],
  ['OCO', { position: 10,   fastestLap: false }],
  ['PER', { position: null, fastestLap: false }], // DNF
])

const aliceEntries = ['VER','PER','LEC','NOR','PIA','RUS','ALO','SAI','HAM','STR']
const bobEntries   = ['LEC','VER','NOR','PIA','RUS','ALO','SAI','HAM','STR','OCO']

describe('computeBaseScore — Monaco race', () => {
  it('Alice : 21 pts, 1 exact (VER P1)', () => {
    const { score, exactPositions } = computeBaseScore(aliceEntries, monacoResults, 'race')
    expect(score).toBe(21)
    expect(exactPositions).toBe(1)
  })

  it('Bob : 44 pts, 8 exacts', () => {
    const { score, exactPositions } = computeBaseScore(bobEntries, monacoResults, 'race')
    expect(score).toBe(44)
    expect(exactPositions).toBe(8)
  })

  it('breakdown Alice : PER DNF → 0 pts, LEC Δ1 → 2 pts', () => {
    const { breakdown } = computeBaseScore(aliceEntries, monacoResults, 'race')
    expect(breakdown.find(e => e.code === 'PER')?.pts).toBe(0)
    expect(breakdown.find(e => e.code === 'PER')?.actualPos).toBeNull()
    expect(breakdown.find(e => e.code === 'LEC')?.pts).toBe(2)
  })
})

describe('computeFastestLap', () => {
  it('Alice prédit NOR (correct) → +1', () => {
    expect(computeFastestLap('NOR', monacoResults)).toBe(1)
  })

  it('Bob prédit VER (incorrect) → 0', () => {
    expect(computeFastestLap('VER', monacoResults)).toBe(0)
  })

  it('null prediction → 0', () => {
    expect(computeFastestLap(null, monacoResults)).toBe(0)
  })
})

describe('computeSessionBaseScore — score total avec FL', () => {
  it('Alice : positions (21) + FL bonus (1) = 22', () => {
    const result = computeSessionBaseScore(aliceEntries, 'NOR', monacoResults, 'race')
    expect(result.baseScore).toBe(22)
    expect(result.finalScore).toBe(22)
    expect(result.exactPositions).toBe(1)
  })

  it('Bob : positions (44) + FL manqué (0) = 44', () => {
    const result = computeSessionBaseScore(bobEntries, 'VER', monacoResults, 'race')
    expect(result.baseScore).toBe(44)
    expect(result.finalScore).toBe(44)
    expect(result.exactPositions).toBe(8)
  })

  it('FL bonus ignoré pour qualifying', () => {
    const result = computeSessionBaseScore(aliceEntries, 'NOR', monacoResults, 'qualifying')
    // même prédiction FL mais session qualifying → pas de bonus
    expect(result.baseScore).toBe(21)
  })
})

describe('cas limites', () => {
  it('tous les pilotes DNF → 0 pts', () => {
    const allDnf = new Map<string, DriverResult>(
      aliceEntries.map(c => [c, { position: null, fastestLap: false }])
    )
    const { score, exactPositions } = computeBaseScore(aliceEntries, allDnf, 'race')
    expect(score).toBe(0)
    expect(exactPositions).toBe(0)
  })

  it('sprint_race : seules 8 positions scorées', () => {
    const entries = ['VER','LEC','NOR','PIA','RUS','ALO','SAI','HAM','STR','OCO']
    const results = new Map<string, DriverResult>(
      entries.map((c, i) => [c, { position: i + 1, fastestLap: false }])
    )
    const { breakdown } = computeBaseScore(entries, results, 'sprint_race')
    expect(breakdown).toHaveLength(8) // STR et OCO non scorés
  })

  it('pilote absent du results map → 0 pts', () => {
    const partialResults = new Map<string, DriverResult>([
      ['VER', { position: 1, fastestLap: false }],
    ])
    const { score } = computeBaseScore(['VER','UNKNOWN'], partialResults, 'race')
    expect(score).toBe(5) // VER exact, UNKNOWN absent → 0
  })
})
