import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'

/**
 * Catalogue partagé des items — source unique des libellés et emojis.
 * Les noms/descriptions vivent en i18n (`items.*` dans lib/i18n/fr.ts) ; les emojis
 * sont des tokens visuels (non traduisibles) définis ici. Réutilisé par la page
 * « Jouer un item » et les « Faits marquants » des résultats GP (issue #151).
 */

/** Items GP implémentés (exclut les items saison wdc_move/wcc_move). */
export const GP_ITEM_TYPES = [
  'shield',
  'block_driver',
  'wild_card',
  'double_points',
  'dnf_prediction',
  'underdog_top5',
  'no_points_team',
  'fia_penalty',
] as const

/**
 * Palier de verrouillage d'un item GP (cf. product-specs §3.5 « Deadline items — deux paliers ») :
 * - `pre_qualifying` : jouable jusqu'au début de la 1ʳᵉ session scorée (Q1, ou Sprint Qualifying) ;
 * - `pre_race`       : jouable jusqu'au départ de la course principale.
 * Source unique — consommé par l'action serveur, la page et le module `availability`.
 */
export type ItemLockPhase = 'pre_qualifying' | 'pre_race'

export const ITEM_LOCK_PHASE: Record<string, ItemLockPhase> = {
  shield:         'pre_qualifying',
  wild_card:      'pre_qualifying',
  double_points:  'pre_qualifying',
  block_driver:   'pre_race',
  dnf_prediction: 'pre_race',
  underdog_top5:  'pre_race',
  no_points_team: 'pre_race',
  fia_penalty:    'pre_race',
}

export const ITEM_EMOJI: Record<string, string> = {
  shield:         '🛡️',
  block_driver:   '🚫',
  wild_card:      '🃏',
  double_points:  '✨',
  dnf_prediction: '💥',
  underdog_top5:  '🔥',
  no_points_team: '💧',
  fia_penalty:    '🚔',
}

const DEFAULT_EMOJI = '🎮'

export interface ItemLabel {
  name:        string
  description: string
  emoji:       string
}

export function itemName(itemType: string): string {
  return t(`items.${itemType}.name` as TranslationKey)
}

export function itemDescription(itemType: string): string {
  return t(`items.${itemType}.description` as TranslationKey)
}

export function itemEmoji(itemType: string): string {
  return ITEM_EMOJI[itemType] ?? DEFAULT_EMOJI
}

export function itemLabel(itemType: string): ItemLabel {
  return { name: itemName(itemType), description: itemDescription(itemType), emoji: itemEmoji(itemType) }
}

/** Map { itemType → libellé } pour tous les items GP — passée aux composants client. */
export function allItemLabels(): Record<string, ItemLabel> {
  return Object.fromEntries(GP_ITEM_TYPES.map((type) => [type, itemLabel(type)]))
}
