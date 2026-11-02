import { describe, it, expect } from 'vitest'
import {
  GP_FINALIZATION_DELAY_MS,
  RESULTS_REVISION_FREEZE_MS,
  isGPReadyToFinalize,
  isResultsRevisionOpen,
} from './finalization'

// Course du GP du Mexique 2026 : départ dimanche 20:00 UTC.
const RACE_STARTS_AT = '2026-11-01T20:00:00Z'
const raceStart = new Date(RACE_STARTS_AT).getTime()
const HOUR_MS = 60 * 60 * 1000

describe('isGPReadyToFinalize', () => {
  it('pas avant le délai de finalisation (pénalités de nuit encore possibles)', () => {
    expect(isGPReadyToFinalize(RACE_STARTS_AT, raceStart + 6 * HOUR_MS)).toBe(false)
    expect(isGPReadyToFinalize(RACE_STARTS_AT, raceStart + GP_FINALIZATION_DELAY_MS - 1)).toBe(false)
  })

  it('finalisable une fois le délai écoulé (lundi 08:00 UTC)', () => {
    expect(isGPReadyToFinalize(RACE_STARTS_AT, raceStart + GP_FINALIZATION_DELAY_MS)).toBe(true)
  })
})

describe('isResultsRevisionOpen', () => {
  it('ouverte pendant la nuit qui suit la course', () => {
    expect(isResultsRevisionOpen(RACE_STARTS_AT, raceStart + 6 * HOUR_MS)).toBe(true)
  })

  it('ouverte pour les séances d\'avant la course (qualifs du samedi)', () => {
    expect(isResultsRevisionOpen(RACE_STARTS_AT, raceStart - 20 * HOUR_MS)).toBe(true)
  })

  // Les deux crons ne se coordonnent pas : une révision ne doit jamais
  // supprimer des scores pendant que le trigger finalise.
  it('fermée avant que la finalisation ne devienne possible (marge de gel)', () => {
    const freezeStart = raceStart + GP_FINALIZATION_DELAY_MS - RESULTS_REVISION_FREEZE_MS
    expect(isResultsRevisionOpen(RACE_STARTS_AT, freezeStart - 1)).toBe(true)
    expect(isResultsRevisionOpen(RACE_STARTS_AT, freezeStart)).toBe(false)
    expect(isResultsRevisionOpen(RACE_STARTS_AT, raceStart + GP_FINALIZATION_DELAY_MS)).toBe(false)
  })
})
