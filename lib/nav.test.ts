import { describe, it, expect } from 'vitest'
import { isActiveRoute, isHiddenRoute } from './nav'

describe('isActiveRoute', () => {
  it('exact : ne matche que l\'égalité stricte', () => {
    expect(isActiveRoute('/', '/', true)).toBe(true)
    expect(isActiveRoute('/leagues', '/', true)).toBe(false)
  })

  it('non-exact : matche le chemin et ses sous-routes', () => {
    expect(isActiveRoute('/leagues', '/leagues')).toBe(true)
    expect(isActiveRoute('/leagues/123', '/leagues')).toBe(true)
    expect(isActiveRoute('/leagues/123/gp/5', '/leagues')).toBe(true)
  })

  it('non-exact : pas de faux positif de préfixe', () => {
    expect(isActiveRoute('/leaguesXYZ', '/leagues')).toBe(false)
    expect(isActiveRoute('/predictions', '/leagues')).toBe(false)
  })
})

describe('isHiddenRoute', () => {
  const prefixes = ['/login', '/onboarding', '/join']

  it('masque les préfixes pré-auth et leurs sous-routes', () => {
    expect(isHiddenRoute('/login', prefixes)).toBe(true)
    expect(isHiddenRoute('/join/abc123', prefixes)).toBe(true)
    expect(isHiddenRoute('/onboarding', prefixes)).toBe(true)
  })

  it('affiche la nav sur les routes authentifiées', () => {
    expect(isHiddenRoute('/', prefixes)).toBe(false)
    expect(isHiddenRoute('/leagues', prefixes)).toBe(false)
    expect(isHiddenRoute('/joined', prefixes)).toBe(false) // pas de faux positif de préfixe
  })
})
