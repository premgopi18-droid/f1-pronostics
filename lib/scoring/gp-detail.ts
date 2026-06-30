import { t } from '@/lib/i18n'
import { itemEmoji, itemName } from '@/lib/items/catalog'
import { deltaKind, formatSignedDelta, type DeltaKind } from './delta'
import { classifyPositionDelta, type PositionMark } from './position-mark'
import { FASTEST_LAP_BONUS, POSITIONS_TO_SCORE, SCORE_TABLES } from './constants'
import type { SessionType } from './types'
import type { ResolvedItem, PlayerIdentity } from '@/lib/items/facts'

/**
 * Vues « détail par joueur » des résultats GP (issue #151) — fonctions pures.
 * Comparaison pronostic vs résultat officiel par position + lignes d'impact des items.
 */

export type { PositionMark }

export interface DetailRow {
  predictedPos: number
  code:         string
  mark:         PositionMark
  delta:        number | null   // écart de positions (partial uniquement)
  actualCode:   string | null   // pilote réellement à cette position (miss)
  pts:          number
}

export interface FastestLapRow {
  code:       string | null
  played:     boolean           // false = aucun meilleur tour pronostiqué (≠ raté)
  isExact:    boolean
  actualCode: string | null
  pts:        number
}

export interface SessionDetail {
  rows:          DetailRow[]
  fastestLap:    FastestLapRow | null   // course uniquement
  exactCount:    number
  approxCount:   number
  hasPrediction: boolean
  invalid:       boolean
}

export interface ItemLine {
  emoji:     string
  text:      string
  deltaText: string
  deltaKind: DeltaKind
}

/** Session d'affichage d'un item dans le détail (les bonus & boucliers se rattachent à la course). */
function itemDisplaySession(item: ResolvedItem): SessionType {
  const session = item.payload.session_type as SessionType | undefined
  return session ?? 'race'
}

export function buildSessionDetail(
  sessionType:      SessionType,
  predictedEntries: string[] | undefined,
  invalid:          boolean,
  resultsByCode:    Map<string, number>,     // code → position réelle
  positionToCode:   Map<number, string>,     // position réelle → code
  predictedFL:      string | undefined,
  actualFL:         string | undefined,
): SessionDetail {
  if (!predictedEntries) {
    return { rows: [], fastestLap: null, exactCount: 0, approxCount: 0, hasPrediction: false, invalid }
  }

  const scoreTable       = SCORE_TABLES[sessionType] as Record<number, number>
  const positionsToScore = POSITIONS_TO_SCORE[sessionType]

  let exactCount  = 0
  let approxCount = 0

  const rows: DetailRow[] = predictedEntries.slice(0, positionsToScore).map((code, i) => {
    const predictedPos = i + 1
    const actualPos    = resultsByCode.get(code)
    const delta        = actualPos !== undefined ? Math.abs(predictedPos - actualPos) : null
    const pts          = delta !== null ? (scoreTable[delta] ?? 0) : 0
    const mark         = classifyPositionDelta(delta, sessionType)

    if (mark === 'exact')   exactCount++
    if (mark === 'partial') approxCount++

    return {
      predictedPos,
      code,
      mark,
      delta:      mark === 'partial' ? delta : null,
      actualCode: mark === 'miss' ? (positionToCode.get(predictedPos) ?? null) : null,
      pts,
    }
  })

  let fastestLap: FastestLapRow | null = null
  if (sessionType === 'race' && (predictedFL || actualFL)) {
    const played  = !!predictedFL
    const isExact = played && predictedFL === actualFL
    fastestLap = {
      code:       predictedFL ?? null,
      played,
      isExact,
      actualCode: isExact ? null : (actualFL ?? null),
      pts:        isExact ? FASTEST_LAP_BONUS : 0,
    }
  }

  return { rows, fastestLap, exactCount, approxCount, hasPrediction: true, invalid: false }
}

/**
 * Lignes d'impact des items pour un membre, regroupées par session d'affichage.
 * Inclut ses propres items (delta acteur) et les items offensifs le ciblant (delta cible).
 */
export function buildMemberItemLines(
  items:            ResolvedItem[],
  memberId:         string,
  identity:         Map<string, PlayerIdentity>,
  shieldedByTarget: Map<string, number>,   // pré-calculé une fois (cf. countShieldedAttacksByTarget)
): Map<SessionType, ItemLine[]> {
  const bySession = new Map<SessionType, ItemLine[]>()
  const push = (session: SessionType, line: ItemLine) => {
    const list = bySession.get(session) ?? []
    list.push(line)
    bySession.set(session, list)
  }
  const pseudoOf = (userId: string) => identity.get(userId)?.pseudo ?? '?'

  for (const item of items) {
    const session     = itemDisplaySession(item)
    const isOffensive = item.itemType === 'block_driver' || item.itemType === 'wild_card'
    const targetId    = item.payload.target_user_id as string | undefined
    const emoji       = itemEmoji(item.itemType)
    const label       = item.itemType === 'block_driver'
      ? `${itemName('block_driver')} ${item.payload.driver_code as string}`
      : itemName(item.itemType)

    // Item joué par le membre lui-même
    if (item.userId === memberId) {
      const delta = item.pointsDeltaActor ?? 0
      let text: string
      if (isOffensive && targetId) {
        text = t('gpResults.detailItemOwnOffensive', { item: label, target: pseudoOf(targetId) })
      } else if (item.itemType === 'shield') {
        const blocked = shieldedByTarget.get(memberId) ?? 0
        text = label + (blocked > 0 ? t('gpResults.detailShieldNeutralized', { pts: blocked }) : '')
      } else {
        text = t('gpResults.detailItemOwn', { item: label })
      }
      if (isOffensive && item.wasShielded) text += t('gpResults.detailCancelledSuffix')
      push(session, { emoji, text, deltaText: formatSignedDelta(delta), deltaKind: deltaKind(delta) })
    }

    // Item offensif ciblant le membre (joué par un autre)
    if (isOffensive && targetId === memberId && item.userId !== memberId) {
      const delta = item.pointsDeltaTarget ?? 0
      let text = t('gpResults.detailItemIncoming', { item: label, actor: pseudoOf(item.userId) })
      if (item.wasShielded) text += t('gpResults.detailCancelledSuffix')
      push(session, { emoji, text, deltaText: formatSignedDelta(delta), deltaKind: deltaKind(delta) })
    }
  }

  return bySession
}
