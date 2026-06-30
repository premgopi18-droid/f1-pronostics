import { SCORE_TABLES } from './constants'
import type { SessionType } from './types'

/** Qualité d'une position pronostiquée vs résultat officiel — règle unique partagée. */
export type PositionMark = 'exact' | 'partial' | 'miss'

/**
 * Classe un écart de positions. `delta` = |position prédite − position réelle|, ou
 * null quand le pilote n'a pas de position officielle. Règle métier : tout écart qui
 * rapporte des points au barème est un « partial ». Source unique réutilisée par le
 * détail des résultats GP et la comparaison de pronos.
 */
export function classifyPositionDelta(delta: number | null, sessionType: SessionType): PositionMark {
  if (delta === null) return 'miss'
  if (delta === 0) return 'exact'
  const scoreTable = SCORE_TABLES[sessionType] as Record<number, number>
  return (scoreTable[delta] ?? 0) > 0 ? 'partial' : 'miss'
}
