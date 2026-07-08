import { describe, expect, it } from 'vitest'
import { ACTION_ERROR_CODES, translateActionError } from './errors'
import { fr } from '@/lib/i18n/fr'

describe('ACTION_ERROR_CODES ↔ catalogue i18n', () => {
  // LE filet anti-régression du pattern : un code sans clé de traduction
  // afficherait le code brut à l'utilisateur.
  it('chaque code possède une clé actionErrors.<code> dans fr.ts', () => {
    for (const code of ACTION_ERROR_CODES) {
      expect(fr.actionErrors[code], `clé manquante : actionErrors.${code}`).toBeTypeOf('string')
      expect(fr.actionErrors[code].length).toBeGreaterThan(0)
    }
  })

  it("aucune clé actionErrors orpheline (clé sans code — catalogue et codes restent synchrones)", () => {
    for (const key of Object.keys(fr.actionErrors)) {
      expect(ACTION_ERROR_CODES as readonly string[], `code manquant pour la clé : ${key}`).toContain(key)
    }
  })
})

describe('translateActionError', () => {
  it('traduit un code connu vers sa copy française', () => {
    expect(translateActionError('notAuthenticated')).toBe('Non authentifié')
    expect(translateActionError('itemExhausted')).toBe('Item épuisé pour cette saison')
  })

  it('interpole les variables des messages paramétrés', () => {
    expect(translateActionError('entriesCountRequired', { count: 10 })).toBe('10 entrées requises')
    expect(translateActionError('invalidCode', { code: 'XXX' })).toBe('Code invalide : XXX')
  })

  it('retombe sur le message générique pour un code inconnu (vieux client pendant un déploiement)', () => {
    expect(translateActionError('someFutureCode')).toBe('Erreur inattendue')
  })
})
