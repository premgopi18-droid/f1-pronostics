// Barème saison §4 scoring-spec — identique pour WDC et WCC
const SEASON_SCORE_TABLE: Record<number, number> = { 0: 8, 1: 3, 2: 1 }
const PODIUM_BONUS = 15

export function computeProjectedScore(
  entries:   string[],             // codes ordonnés (prediction)
  standings: Map<string, number>,  // code → position officielle
): { score: number; bonus: number; exacts: number } {
  let score       = 0
  let exacts      = 0
  let podiumExact = 0

  for (let i = 0; i < entries.length; i++) {
    const code      = entries[i]
    const predicted = i + 1
    const official  = standings.get(code) ?? null

    if (official === null) continue

    const delta = Math.abs(predicted - official)
    const pts   = SEASON_SCORE_TABLE[delta] ?? 0

    if (delta === 0) {
      exacts++
      if (predicted <= 3) podiumExact++
    }

    score += pts
  }

  return { score, bonus: podiumExact === 3 ? PODIUM_BONUS : 0, exacts }
}
