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
  maxMembers: number
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

export const GP_ITEM_EMOJI: Record<GpItemType, string> = {
  shield:          '🛡️',
  block_driver:    '🚫',
  wild_card:       '🃏',
  double_points:   '✨',
  dnf_prediction:  '💥',
  underdog_top5:   '🔥',
  no_points_team:  '💧',
  fia_penalty:     '🚔',
}

type ScoreEntry = { user_id: string; final_score: number; exact_positions: number }
type SeasonEntry = { user_id: string; total: number }

/**
 * Calcule le rang de l'utilisateur dans une ligue à partir des scores bruts.
 * Les membres sans aucune ligne de score sont à 0 pt et n'influencent pas le rang
 * tant que leur total est égal au mien (comportement acceptable en début de saison).
 */
export function computeMyRank(
  scoreRows: ScoreEntry[],
  seasonRows: SeasonEntry[],
  userId: string,
): number {
  const totalByUser = new Map<string, number>()
  const exactByUser = new Map<string, number>()

  for (const row of scoreRows) {
    totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + (row.final_score ?? 0))
    exactByUser.set(row.user_id, (exactByUser.get(row.user_id) ?? 0) + (row.exact_positions ?? 0))
  }
  for (const row of seasonRows) {
    totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + (row.total ?? 0))
  }

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
  scoreRows: ScoreEntry[],
  seasonRows: SeasonEntry[],
  userId: string,
): number {
  const fromScores = scoreRows
    .filter((r) => r.user_id === userId)
    .reduce((sum, r) => sum + (r.final_score ?? 0), 0)
  const fromSeason = seasonRows.find((r) => r.user_id === userId)?.total ?? 0
  return fromScores + fromSeason
}
