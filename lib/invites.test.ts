import { describe, it, expect } from 'vitest'
import { INVITE_CODE_PATTERN } from './invites'

describe('INVITE_CODE_PATTERN', () => {
  it('accepte 8 caractères hexadécimaux (toute casse)', () => {
    expect(INVITE_CODE_PATTERN.test('ABCD1234')).toBe(true)
    expect(INVITE_CODE_PATTERN.test('abcd1234')).toBe(true)
    expect(INVITE_CODE_PATTERN.test('00ffAA99')).toBe(true)
  })

  it('rejette une longueur incorrecte', () => {
    expect(INVITE_CODE_PATTERN.test('ABC123')).toBe(false)
    expect(INVITE_CODE_PATTERN.test('ABCD12345')).toBe(false)
    expect(INVITE_CODE_PATTERN.test('')).toBe(false)
  })

  it('rejette les caractères non hexadécimaux', () => {
    expect(INVITE_CODE_PATTERN.test('GHIJKLMN')).toBe(false)
    expect(INVITE_CODE_PATTERN.test('ABCD-234')).toBe(false)
    expect(INVITE_CODE_PATTERN.test('ABCD 234')).toBe(false)
  })
})
