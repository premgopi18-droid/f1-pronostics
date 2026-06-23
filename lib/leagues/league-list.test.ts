import { describe, it, expect } from 'vitest'
import { computeMyRank, computeMyPoints } from './league-list'

const SCORES = (entries: Array<[string, number, number]>) =>
  entries.map(([user_id, final_score, exact_positions]) => ({
    user_id,
    final_score,
    exact_positions,
  }))

describe('computeMyRank', () => {
  it('retourne 1 pour le meilleur score', () => {
    const scores = SCORES([['a', 100, 10], ['b', 80, 8], ['c', 60, 6]])
    expect(computeMyRank(scores, [], 'a')).toBe(1)
  })

  it('retourne le rang correct pour un joueur en milieu de tableau', () => {
    const scores = SCORES([['a', 100, 10], ['b', 80, 8], ['c', 60, 6]])
    expect(computeMyRank(scores, [], 'b')).toBe(2)
    expect(computeMyRank(scores, [], 'c')).toBe(3)
  })

  it('utilise exact_positions comme départage à égalité de points', () => {
    const scores = SCORES([['a', 100, 8], ['b', 100, 12]])
    expect(computeMyRank(scores, [], 'a')).toBe(2)
    expect(computeMyRank(scores, [], 'b')).toBe(1)
  })

  it('intègre les bonus saison dans le total', () => {
    const scores = SCORES([['a', 50, 5], ['b', 100, 10]])
    const season = [{ user_id: 'a', total: 80 }] // a: 130, b: 100
    expect(computeMyRank(scores, season, 'a')).toBe(1)
    expect(computeMyRank(scores, season, 'b')).toBe(2)
  })

  it('retourne 1 quand personne n\'a de score (début de saison)', () => {
    expect(computeMyRank([], [], 'a')).toBe(1)
  })

  it('retourne 1 quand l\'utilisateur est à 0 pt et les autres aussi', () => {
    const scores = SCORES([['b', 0, 0], ['c', 0, 0]])
    expect(computeMyRank(scores, [], 'a')).toBe(1)
  })

  it('accumule plusieurs lignes de scores pour le même utilisateur', () => {
    const scores = SCORES([['a', 30, 3], ['a', 50, 5], ['b', 100, 10]])
    // a: 80 pts, b: 100 pts → a est 2e
    expect(computeMyRank(scores, [], 'a')).toBe(2)
  })
})

describe('computeMyPoints', () => {
  it('somme les final_score de l\'utilisateur uniquement', () => {
    const scores = SCORES([['a', 30, 3], ['a', 50, 5], ['b', 100, 10]])
    expect(computeMyPoints(scores, [], 'a')).toBe(80)
  })

  it('ajoute le bonus saison au total', () => {
    const scores = SCORES([['a', 80, 8]])
    const season = [{ user_id: 'a', total: 40 }]
    expect(computeMyPoints(scores, season, 'a')).toBe(120)
  })

  it('retourne 0 pour un utilisateur sans score ni bonus saison', () => {
    expect(computeMyPoints([], [], 'a')).toBe(0)
  })

  it('ignore les scores des autres utilisateurs', () => {
    const scores = SCORES([['b', 200, 20]])
    expect(computeMyPoints(scores, [], 'a')).toBe(0)
  })
})
