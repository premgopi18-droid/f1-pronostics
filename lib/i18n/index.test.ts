import { afterEach, describe, expect, it, vi } from 'vitest'
import { t, type TranslationKey } from './index'

// Les gardes de t() loguent en dev (NODE_ENV=test compris) — on les silencie
// et on vérifie qu'ils se déclenchent.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('t', () => {
  it('résout une clé existante', () => {
    expect(t('common.loading')).toBe('Chargement…')
  })

  it('interpole les placeholders fournis', () => {
    expect(t('predict.savedDraft', { count: 8, total: 10 })).toContain('(8/10)')
  })

  it('clé introuvable : rend la clé brute et crie en dev — jamais undefined', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Le scénario réel est un cast `as TranslationKey` sur une clé dynamique
    // fantôme (vécu avec predict.tab.* supprimées, #228).
    const ghostKey = 'predict.tab.race' as TranslationKey
    expect(t(ghostKey)).toBe('predict.tab.race')
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('placeholder non fourni : chaîne vide et cri en dev', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rendered = t('gpResults.chainBlockShielded', {})
    expect(rendered).not.toContain('{target}')
    expect(consoleError).toHaveBeenCalled()
  })
})
