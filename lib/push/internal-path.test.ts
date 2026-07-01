import { describe, it, expect } from 'vitest'
import { toInternalPath } from './internal-path'

describe('toInternalPath', () => {
  it('accepte un chemin interne absolu', () => {
    expect(toInternalPath('/whats-new')).toBe('/whats-new')
    expect(toInternalPath('/predictions/42')).toBe('/predictions/42')
  })

  it('conserve query et fragment', () => {
    expect(toInternalPath('/leagues?tab=items#top')).toBe('/leagues?tab=items#top')
  })

  it('rejette une URL absolue externe', () => {
    expect(toInternalPath('https://evil.example/phish')).toBe('/')
    expect(toInternalPath('http://evil.example')).toBe('/')
  })

  it('rejette une URL protocol-relative (//host)', () => {
    expect(toInternalPath('//evil.example/phish')).toBe('/')
  })

  it('rejette un chemin relatif sans slash initial', () => {
    expect(toInternalPath('whats-new')).toBe('/')
  })

  it('retombe sur le fallback pour null/undefined/vide', () => {
    expect(toInternalPath(null)).toBe('/')
    expect(toInternalPath(undefined)).toBe('/')
    expect(toInternalPath('')).toBe('/')
  })

  it('utilise le fallback fourni', () => {
    expect(toInternalPath(null, '/whats-new')).toBe('/whats-new')
    expect(toInternalPath('//evil.example', '/whats-new')).toBe('/whats-new')
  })
})
