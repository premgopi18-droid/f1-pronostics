import { describe, it, expect } from 'vitest'
import { isActiveRoute, isHiddenRoute, isHighlightedTab } from './nav'

describe('isHighlightedTab', () => {
  const home = { href: '/', exact: true }
  const leagues = { href: '/leagues' }

  it('sans navigation en cours : suit le chemin courant', () => {
    expect(isHighlightedTab('/leagues/123', leagues, null)).toBe(true)
    expect(isHighlightedTab('/leagues/123', home, null)).toBe(false)
  })

  it('navigation en cours : seule la destination tapée s\'allume', () => {
    expect(isHighlightedTab('/leagues/123', home, '/')).toBe(true)
    expect(isHighlightedTab('/leagues/123', leagues, '/')).toBe(false)
  })

  it('navigation en cours : `exact` est ignoré, seul le href tapé compte', () => {
    expect(isHighlightedTab('/leagues/1/gp/2', home, '/')).toBe(true)
    expect(isHighlightedTab('/leagues', leagues, '/leagues')).toBe(true)
  })
})

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
