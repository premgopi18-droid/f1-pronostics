import { aggregateTotals, type ScoreRow, type SeasonScoreRow } from './standings'

export type GpItemType =
  | 'shield'
  | 'block_driver'
  | 'wild_card'
  | 'double_points'
  | 'dnf_prediction'
  | 'underdog_top5'
  | 'no_points_team'
  | 'fia_penalty'

export type ItemStock = {
  itemType: GpItemType
  usesRemaining: number
}

export type LeagueSummary = {
  leagueId: string
  name: string
  isAdmin: boolean
  joinedAt: string
  memberCount: number
  myRank: number
  myPoints: number
  items: ItemStock[]
}

/** Items GP affichés sur la card — items saison (wdc_move, wcc_move) exclus. */
export const GP_ITEM_TYPES: readonly GpItemType[] = [
  'shield',
  'block_driver',
  'wild_card',
  'double_points',
  'dnf_prediction',
  'underdog_top5',
  'no_points_team',
  'fia_penalty',
]

/**
 * Calcule le rang de l'utilisateur dans une ligue à partir des scores bruts.
 * Les membres sans aucune ligne de score sont à 0 pt et n'influencent pas le rang
 * tant que leur total est égal au mien (comportement acceptable en début de saison).
 *
 * S'appuie sur `aggregateTotals` (même agrégation/départage que `buildStandings`).
 */
export function computeMyRank(
  scoreRows: ScoreRow[],
  seasonRows: SeasonScoreRow[],
  userId: string,
): number {
  const { totalByUser, exactByUser } = aggregateTotals(scoreRows, seasonRows)

  const myTotal = totalByUser.get(userId) ?? 0
  const myExact = exactByUser.get(userId) ?? 0

  let rank = 1
  for (const [uid, total] of totalByUser) {
    if (uid === userId) continue
    const theirExact = exactByUser.get(uid) ?? 0
    if (total > myTotal || (total === myTotal && theirExact > myExact)) {
      rank++
    }
  }

  return rank
}

/** Somme des points de l'utilisateur (scores GP + bonus saison) dans une ligue. */
export function computeMyPoints(
  scoreRows: ScoreRow[],
  seasonRows: SeasonScoreRow[],
  userId: string,
): number {
  const { totalByUser } = aggregateTotals(scoreRows, seasonRows)
  return totalByUser.get(userId) ?? 0
}
