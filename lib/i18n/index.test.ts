import { afterEach, describe, expect, it, vi } from 'vitest'
import { t, tSegments, type TranslationKey } from './index'

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

describe('tSegments', () => {
  it('découpe le message : valeurs interpolées en emphasis, texte fixe non', () => {
    const segments = tSegments('items.confirm.recap.wild_card', {
      item: 'Wild Card', opponent: 'Victor', session: 'Course',
    })
    expect(segments.map((s) => s.text).join('')).toBe(
      'Tu vas jouer Wild Card contre Victor : tu lui voleras la moitié de ses points en Course.',
    )
    expect(segments.filter((s) => s.emphasis).map((s) => s.text)).toEqual([
      'Wild Card', 'Victor', 'Course',
    ])
  })

  it('vars superflues ignorées, sans cri', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    tSegments('items.confirm.recap.shield', { item: 'Bouclier', opponent: 'inutile' })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('placeholder non fourni : segment vide et cri en dev', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const segments = tSegments('items.confirm.recap.shield', {})
    expect(segments.map((s) => s.text).join('')).not.toContain('{item}')
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('clé introuvable : rend la clé brute en un segment — jamais undefined', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ghostKey = 'items.confirm.recap.ghost_item' as TranslationKey
    expect(tSegments(ghostKey, {})).toEqual([{ text: ghostKey, emphasis: false }])
    expect(consoleError).toHaveBeenCalledOnce()
  })
})

describe('items.confirm.recap — couverture des items jouables', () => {
  // Miroir de PLAYABLE_ITEMS (play-item-form.tsx). Le formulaire résout la clé de
  // récap via un cast `as TranslationKey` sur clé dynamique — ce test est le
  // garde-fou contre une clé manquante ou supprimée du catalogue (#228).
  const playableItems = [
    'shield', 'block_driver', 'wild_card', 'double_points',
    'dnf_prediction', 'underdog_top5', 'no_points_team',
  ]

  it.each(playableItems)('une phrase de récap existe pour %s', (itemType) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const key = `items.confirm.recap.${itemType}` as TranslationKey
    expect(t(key)).not.toBe(key)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
