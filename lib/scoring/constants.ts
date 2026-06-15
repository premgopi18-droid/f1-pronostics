export const SCORE_TABLES = {
  qualifying:        { 0: 5, 1: 2, 2: 1 },
  race:              { 0: 5, 1: 2, 2: 1 },
  sprint_qualifying: { 0: 3, 1: 1 },
  sprint_race:       { 0: 3, 1: 1 },
} as const

export const SEASON_SCORE_TABLE = { 0: 8, 1: 3, 2: 1 } as const
export const SEASON_PODIUM_BONUS = 15
export const FASTEST_LAP_BONUS  = 1

export const ITEM_BONUS_POINTS = {
  dnf_prediction: 8,
  underdog_top5:  8,
  no_points_team: 12,
  fia_penalty:    10, // nice-to-have — voir product-specs §3.5
} as const

export const ITEM_USES_PER_SEASON: Record<string, number> = {
  shield:         3,
  block_driver:   1,
  wild_card:      1,
  double_points:  1,
  dnf_prediction: 1,
  underdog_top5:  1,
  no_points_team: 1,
  fia_penalty:    1, // nice-to-have
  wdc_move:       1,
  wcc_move:       1,
}
