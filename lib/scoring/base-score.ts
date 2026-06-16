import { SCORE_TABLES, POSITIONS_TO_SCORE, FASTEST_LAP_BONUS } from './constants'
import type { SessionType, DriverResult, SessionScore, BreakdownEntry } from './types'

export function computeBaseScore(
  entries: string[],
  results: Map<string, DriverResult>,
  sessionType: SessionType,
): { score: number; exactPositions: number; breakdown: BreakdownEntry[] } {
  const table = SCORE_TABLES[sessionType] as Record<number, number>
  const positionsToScore = POSITIONS_TO_SCORE[sessionType]
  let score = 0
  let exactPositions = 0
  const breakdown: BreakdownEntry[] = []

  for (let i = 0; i < positionsToScore; i++) {
    const code = entries[i]
    const predictedPos = i + 1
    const actualPos = results.get(code)?.position ?? null

    let points = 0
    if (actualPos !== null) {
      const delta = Math.abs(predictedPos - actualPos)
      points = table[delta] ?? 0
    }

    if (actualPos === predictedPos) exactPositions++
    score += points
    breakdown.push({ code, predictedPos, actualPos, pts: points })
  }

  return { score, exactPositions, breakdown }
}

export function computeFastestLap(
  predictedCode: string | null,
  results: Map<string, DriverResult>,
): number {
  if (!predictedCode) return 0
  return results.get(predictedCode)?.fastestLap ? FASTEST_LAP_BONUS : 0
}

export function computeSessionBaseScore(
  entries: string[],
  fastestLapPrediction: string | null,
  results: Map<string, DriverResult>,
  sessionType: SessionType,
): SessionScore {
  const { score, exactPositions, breakdown } = computeBaseScore(entries, results, sessionType)
  const flPts = sessionType === 'race' ? computeFastestLap(fastestLapPrediction, results) : 0
  const total = score + flPts

  return {
    baseScore: total,
    finalScore: total,
    exactPositions,
    breakdown,
  }
}
