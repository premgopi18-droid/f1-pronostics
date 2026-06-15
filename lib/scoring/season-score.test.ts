import { describe, it, expect } from 'vitest'
import { computeSeasonScore } from './season-score'

// WDC officiel fictif 2026
const wdcResults = new Map([
  ['VER', 1], ['NOR', 2], ['LEC', 3], ['PIA', 4], ['RUS', 5],
  ['ALO', 6], ['SAI', 7], ['HAM', 8], ['STR', 9], ['OCO', 10],
])

// WCC officiel fictif 2026 (11 écuries)
const wccResults = new Map([
  ['RED_BULL', 1], ['MCLAREN', 2], ['FERRARI', 3], ['MERCEDES', 4], ['ASTON_MARTIN', 5],
  ['WILLIAMS', 6], ['HAAS', 7], ['ALPINE', 8], ['RB', 9], ['SAUBER', 10], ['STAKE', 11],
])

describe('computeSeasonScore — WDC', () => {
  it('prédiction parfaite → 10×8=80 pts + bonus podium 15 = 95', () => {
    const entries = ['VER','NOR','LEC','PIA','RUS','ALO','SAI','HAM','STR','OCO']
    const { score, bonus } = computeSeasonScore(entries, wdcResults)
    expect(score).toBe(80)
    expect(bonus).toBe(15)
  })

  it('tous Δ=1 → 10×3=30 pts, pas de bonus', () => {
    // Décale tout d'une position
    const entries = ['NOR','VER','PIA','LEC','ALO','RUS','HAM','SAI','OCO','STR']
    const { score, bonus } = computeSeasonScore(entries, wdcResults)
    expect(score).toBe(30)
    expect(bonus).toBe(0)
  })

  it('Δ=2 → 1 pt (prédit P1, réel P3)', () => {
    const results = new Map([['LEC', 3]])
    const { score, bonus } = computeSeasonScore(['LEC'], results)
    expect(score).toBe(1)
    expect(bonus).toBe(0)
  })

  it('Δ>2 → 0 pt (prédit P1, réel P7)', () => {
    const results = new Map([['VER', 7]])
    const { score, bonus } = computeSeasonScore(['VER'], results)
    expect(score).toBe(0)
    expect(bonus).toBe(0)
  })
})

describe('computeSeasonScore — bonus podium', () => {
  it('P1+P2+P3 exacts → +15', () => {
    const entries = ['VER','NOR','LEC','RUS','PIA','ALO','SAI','HAM','STR','OCO']
    const { bonus } = computeSeasonScore(entries, wdcResults)
    expect(bonus).toBe(15)
  })

  it('P1+P2 exacts mais P3 faux → 0 bonus', () => {
    const entries = ['VER','NOR','PIA','LEC','RUS','ALO','SAI','HAM','STR','OCO']
    // VER P1✓, NOR P2✓, PIA prédit P3 mais réel P4 → pas de bonus
    const { bonus } = computeSeasonScore(entries, wdcResults)
    expect(bonus).toBe(0)
  })

  it('podium partiel (1 exact) → 0 bonus', () => {
    const entries = ['VER','LEC','NOR','PIA','RUS','ALO','SAI','HAM','STR','OCO']
    // VER P1✓, LEC prédit P2 mais réel P3, NOR prédit P3 mais réel P2
    const { bonus } = computeSeasonScore(entries, wdcResults)
    expect(bonus).toBe(0)
  })
})

describe('computeSeasonScore — WCC', () => {
  it('prédiction parfaite 11 écuries → 11×8=88 + 15 = 103', () => {
    const entries = ['RED_BULL','MCLAREN','FERRARI','MERCEDES','ASTON_MARTIN','WILLIAMS','HAAS','ALPINE','RB','SAUBER','STAKE']
    const { score, bonus } = computeSeasonScore(entries, wccResults)
    expect(score).toBe(88)
    expect(bonus).toBe(15)
  })
})

describe('cas limites', () => {
  it('pilote absent du classement final → ignoré (0 pt, pas de crash)', () => {
    const entries = ['VER','NOR','ABSENT','LEC','RUS','ALO','SAI','HAM','STR','OCO']
    const { score } = computeSeasonScore(entries, wdcResults)
    // VER exact (8), NOR exact (8), ABSENT ignoré, LEC prédit P4 réel P3 Δ1 (3), RUS exact (8) ...
    expect(score).toBeGreaterThan(0) // pas de crash
  })

  it('liste vide → 0 pts', () => {
    const { score, bonus } = computeSeasonScore([], wdcResults)
    expect(score).toBe(0)
    expect(bonus).toBe(0)
  })
})
