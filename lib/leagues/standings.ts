export type ProfileSummary = { pseudo: string; avatarKey: string | null; avatarUrl: string | null }

export type Standing = {
  user_id:  string
  is_admin: boolean
  profile:  ProfileSummary
  total:    number
  exact:    number
}

export type MemberRow = {
  user_id:  string
  is_admin: boolean
  profile:  ProfileSummary
}

export type ScoreRow = {
  user_id:         string
  final_score:     number
  exact_positions: number
}

export type SeasonScoreRow = {
  user_id: string
  total:   number
}

/**
 * Agrège les points par utilisateur : total = SUM(scores.final_score) + season_scores.total,
 * et somme des positions exactes (départage). Source unique de la formule de classement —
 * réutilisée par `buildStandings` et par les calculs de rang/points de la liste des ligues.
 */
export function aggregateTotals(
  scoreRows:  ScoreRow[],
  seasonRows: SeasonScoreRow[],
): { totalByUser: Map<string, number>; exactByUser: Map<string, number> } {
  const totalByUser = new Map<string, number>()
  const exactByUser = new Map<string, number>()

  for (const row of scoreRows) {
    totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + (row.final_score ?? 0))
    exactByUser.set(row.user_id, (exactByUser.get(row.user_id) ?? 0) + (row.exact_positions ?? 0))
  }
  for (const row of seasonRows) {
    totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + (row.total ?? 0))
  }

  return { totalByUser, exactByUser }
}

export function buildStandings(
  members:    MemberRow[],
  scoreRows:  ScoreRow[],
  seasonRows: SeasonScoreRow[],
): Standing[] {
  const { totalByUser, exactByUser } = aggregateTotals(scoreRows, seasonRows)

  return members
    .map((m) => ({
      user_id:  m.user_id,
      is_admin: m.is_admin,
      profile:  m.profile,
      total:    totalByUser.get(m.user_id) ?? 0,
      exact:    exactByUser.get(m.user_id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return b.exact - a.exact
    })
}
