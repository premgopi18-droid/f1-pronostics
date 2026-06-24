import { describe, expect, it } from 'vitest'
import { config } from './proxy'

// Le matcher Next est une regex de chemin. On la teste directement pour verrouiller le fait
// que les ressources PWA publiques (sw.js, manifest) ne passent PAS par le proxy d'auth —
// sinon elles seraient redirigées vers /login et l'app ne serait jamais installable.
const matcher = new RegExp(`^${config.matcher[0]}$`)

describe('proxy matcher', () => {
  it('laisse passer les ressources PWA publiques (hors gate auth)', () => {
    expect(matcher.test('/sw.js')).toBe(false)
    expect(matcher.test('/manifest.webmanifest')).toBe(false)
  })

  it('ignore aussi les assets statiques et images', () => {
    expect(matcher.test('/_next/static/chunk.js')).toBe(false)
    expect(matcher.test('/favicon.ico')).toBe(false)
    expect(matcher.test('/icons/icon-192.png')).toBe(false)
  })

  it('continue de protéger les routes applicatives', () => {
    expect(matcher.test('/')).toBe(true)
    expect(matcher.test('/profile')).toBe(true)
    expect(matcher.test('/leagues/join')).toBe(true)
    expect(matcher.test('/api/leagues')).toBe(true)
  })
})
