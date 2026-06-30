import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { itemEmoji, itemName } from '@/lib/items/catalog'
import { FASTEST_LAP_BONUS, POSITIONS_TO_SCORE, SCORE_TABLES } from './constants'
import type { SessionType } from './types'
import type { ResolvedItem, PlayerIdentity } from '@/lib/items/facts'

/**
 * Vues « détail par joueur » des résultats GP (issue #151) — fonctions pures.
 * Comparaison pronostic vs résultat officiel par position + lignes d'impact des items.
 */

export type PositionMark = 'exact' | 'partial' | 'miss'

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
  isExact:    boolean
  actualCode: string | null
  pts:        number
}

export interface SessionDetail {
  rows:          DetailRow[]
  fl:            FastestLapRow | null   // course uniquement
  exactCount:    number
  approxCount:   number
  hasPrediction: boolean
  invalid:       boolean
}

export interface ItemLine {
  emoji:     string
  text:      string
  deltaText: string
  deltaKind: 'pos' | 'neg' | 'nil'
}

function fmtSigned(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

function deltaKind(n: number): 'pos' | 'neg' | 'nil' {
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return 'nil'
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

/** Session d'affichage d'un item dans le détail (les bonus & boucliers se rattachent à la course). */
export function itemDisplaySession(item: ResolvedItem): SessionType {
  const s = item.payload.session_type as SessionType | undefined
  return s ?? 'race'
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
    return { rows: [], fl: null, exactCount: 0, approxCount: 0, hasPrediction: false, invalid }
  }

  const scoreTable       = SCORE_TABLES[sessionType] as Record<number, number>
  const positionsToScore = POSITIONS_TO_SCORE[sessionType]

  let exactCount  = 0
  let approxCount = 0

  const rows: DetailRow[] = predictedEntries.slice(0, positionsToScore).map((code, i) => {
    const predictedPos = i + 1
    const actualPos    = resultsByCode.get(code)
    const delta        = actualPos !== undefined ? Math.abs(predictedPos - actualPos) : undefined
    const pts          = delta !== undefined ? (scoreTable[delta] ?? 0) : 0

    let mark: PositionMark
    if (delta === 0) { mark = 'exact'; exactCount++ }
    else if (delta !== undefined && pts > 0) { mark = 'partial'; approxCount++ }
    else mark = 'miss'

    return {
      predictedPos,
      code,
      mark,
      delta:      mark === 'partial' ? delta! : null,
      actualCode: mark === 'miss' ? (positionToCode.get(predictedPos) ?? null) : null,
      pts,
    }
  })

  let fl: FastestLapRow | null = null
  if (sessionType === 'race' && (predictedFL || actualFL)) {
    const isExact = !!predictedFL && predictedFL === actualFL
    fl = {
      code:       predictedFL ?? null,
      isExact,
      actualCode: isExact ? null : (actualFL ?? null),
      pts:        isExact ? FASTEST_LAP_BONUS : 0,
    }
  }

  return { rows, fl, exactCount, approxCount, hasPrediction: true, invalid: false }
}

/**
 * Lignes d'impact des items pour un membre, regroupées par session d'affichage.
 * Inclut ses propres items (delta acteur) et les items offensifs le ciblant (delta cible).
 */
export function buildMemberItemLines(
  items:      ResolvedItem[],
  memberId:   string,
  identity:   Map<string, PlayerIdentity>,
): Map<SessionType, ItemLine[]> {
  const bySession = new Map<SessionType, ItemLine[]>()
  const push = (session: SessionType, line: ItemLine) => {
    const list = bySession.get(session) ?? []
    list.push(line)
    bySession.set(session, list)
  }
  const pseudoOf = (userId: string) => identity.get(userId)?.pseudo ?? '?'

  for (const item of items) {
    const session   = itemDisplaySession(item)
    const isOffensive = item.itemType === 'block_driver' || item.itemType === 'wild_card'
    const targetId  = item.payload.target_user_id as string | undefined
    const emoji     = itemEmoji(item.itemType)
    const label     = item.itemType === 'block_driver'
      ? `${itemName('block_driver')} ${item.payload.driver_code as string}`
      : itemName(item.itemType)

    // Item joué par le membre lui-même
    if (item.userId === memberId) {
      const delta = item.pointsDeltaActor ?? 0
      let text: string
      if (isOffensive && targetId) {
        text = fill(t('gpResults.detailItemOwnOffensive' as TranslationKey), { item: label, target: pseudoOf(targetId) })
      } else if (item.itemType === 'shield') {
        const blocked = countShielded(items, memberId)
        text = label + (blocked > 0
          ? fill(t('gpResults.detailShieldNeutralized' as TranslationKey), { pts: blocked })
          : '')
      } else {
        text = fill(t('gpResults.detailItemOwn' as TranslationKey), { item: label })
      }
      if (isOffensive && item.wasShielded) text += t('gpResults.detailCancelledSuffix')
      push(session, { emoji, text, deltaText: fmtSigned(delta), deltaKind: deltaKind(delta) })
    }

    // Item offensif ciblant le membre (joué par un autre)
    if (isOffensive && targetId === memberId && item.userId !== memberId) {
      const delta = item.pointsDeltaTarget ?? 0
      let text = fill(t('gpResults.detailItemIncoming' as TranslationKey), { item: label, actor: pseudoOf(item.userId) })
      if (item.wasShielded) text += t('gpResults.detailCancelledSuffix')
      push(session, { emoji, text, deltaText: fmtSigned(delta), deltaKind: deltaKind(delta) })
    }
  }

  return bySession
}

function countShielded(items: ResolvedItem[], targetId: string): number {
  return items.filter(
    (i) => (i.itemType === 'block_driver' || i.itemType === 'wild_card')
      && i.wasShielded
      && (i.payload.target_user_id as string | undefined) === targetId,
  ).length
}
