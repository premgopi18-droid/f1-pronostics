import { SEASON_SCORE_TABLE, SEASON_PODIUM_BONUS } from './constants'

/**
 * Calcule le score WDC ou WCC d'un utilisateur.
 * entries : codes ordonnés depuis season_predictions.entries
 * officialResults : code → position finale officielle
 */
export function computeSeasonScore(
  entries: string[],
  officialResults: Map<string, number>,
): { score: number; bonus: number } {
  const table = SEASON_SCORE_TABLE as Record<number, number>
  let score = 0
  let podiumExact = 0

  for (let i = 0; i < entries.length; i++) {
    const predictedPos = i + 1
    const actualPos = officialResults.get(entries[i]) ?? null

    if (actualPos === null) continue // pilote/écurie absente du classement final

    const delta = Math.abs(predictedPos - actualPos)
    const pts = table[delta] ?? 0

    if (delta === 0 && predictedPos <= 3) podiumExact++
    score += pts
  }

  return { score, bonus: podiumExact === 3 ? SEASON_PODIUM_BONUS : 0 }
}
