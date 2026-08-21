import { t } from '@/lib/i18n'
import { SESSION_SHORT_LABEL_KEY } from '@/lib/i18n/session-labels'
import type { SessionType } from './types'

/**
 * Libellé court d'une session (« Qualifs », « Course », …) — passe par le jeu
 * unique de clés (#221). Lookup typé sans cast : une clé supprimée du catalogue
 * redevient une erreur de compilation ici.
 */
export function sessionLabel(type: SessionType): string
export function sessionLabel(type: SessionType | undefined): string | undefined
export function sessionLabel(type: SessionType | undefined): string | undefined {
  if (!type) return undefined
  return t(SESSION_SHORT_LABEL_KEY[type])
}
