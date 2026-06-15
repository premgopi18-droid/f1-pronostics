export type SessionType = 'qualifying' | 'race' | 'sprint_qualifying' | 'sprint_race'

export type ItemPayload =
  | { type: 'shield' }
  | { type: 'block_driver';   targetUserId: string; sessionType: SessionType; driverCode: string }
  | { type: 'wild_card';      targetUserId: string; sessionType: SessionType; pointsStolen?: number }
  | { type: 'double_points';  sessionType: SessionType }
  | { type: 'dnf_prediction'; driverCode: string }
  | { type: 'underdog_top5';  driverCode: string }
  | { type: 'no_points_team'; constructorCode: string }
  | { type: 'fia_penalty';    driverCode: string }        // nice-to-have — voir product-specs §3.5
  | { type: 'wdc_move';       code: string; fromPosition: number; toPosition: number }
  | { type: 'wcc_move';       code: string; fromPosition: number; toPosition: number }

export type GPItemType = Exclude<ItemPayload['type'], 'wdc_move' | 'wcc_move'>

export type DriverResult = { position: number | null; fastestLap: boolean }

/** `${userId}:${sessionType}` — clé O(1) pour la Map des scores */
export type ScoreKey = `${string}:${string}`

export interface BreakdownEntry {
  code:         string
  predictedPos: number
  actualPos:    number | null
  pts:          number
}

export interface SessionScore {
  baseScore:      number
  finalScore:     number
  exactPositions: number
  breakdown:      BreakdownEntry[]
}

export interface ResolutionContext {
  raceResults:        Map<string, DriverResult>
  qualifyingResults:  Map<string, DriverResult>
  leagueId:           string
  gpId:               string
}

export interface PlayedItem {
  id:          string
  userId:      string
  type:        GPItemType
  payload:     ItemPayload
  wasShielded: boolean
}
