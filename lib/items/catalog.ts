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

/** Items GP dont l'effet est réellement résolu par le moteur (exclut fia_penalty). */
export const RESOLVED_GP_ITEM_TYPES = [
  'shield',
  'block_driver',
  'wild_card',
  'double_points',
  'dnf_prediction',
  'underdog_top5',
  'no_points_team',
] as const

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
