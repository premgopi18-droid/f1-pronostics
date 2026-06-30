import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import type { SessionType } from './types'

/**
 * Libellé court d'une session (« Qualifs », « Course », …) — source unique.
 * Réutilise les clés `predict.tab.*` partagées avec l'écran de pronostics.
 */
export function sessionLabel(type: SessionType): string
export function sessionLabel(type: SessionType | undefined): string | undefined
export function sessionLabel(type: SessionType | undefined): string | undefined {
  if (!type) return undefined
  return t(`predict.tab.${type}` as TranslationKey)
}
