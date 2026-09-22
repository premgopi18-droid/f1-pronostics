import { describe, it, expect } from 'vitest'
import { hasSplashPlayed, SPLASH_PLAYED_GLOBAL } from './splash'

describe('hasSplashPlayed', () => {
  it('vrai uniquement quand le boot script a posé le marqueur du chargement', () => {
    expect(hasSplashPlayed({ [SPLASH_PLAYED_GLOBAL]: true })).toBe(true)
  })

  it('faux sans marqueur ou avec une valeur inattendue', () => {
    expect(hasSplashPlayed({})).toBe(false)
    expect(hasSplashPlayed({ [SPLASH_PLAYED_GLOBAL]: '1' })).toBe(false)
    expect(hasSplashPlayed({ [SPLASH_PLAYED_GLOBAL]: false })).toBe(false)
  })
})
