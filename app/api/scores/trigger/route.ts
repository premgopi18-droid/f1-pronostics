import 'server-only'
import { getActiveLeagues, getLeagueMembers } from '@/lib/data/leagues'
import {
  getCurrentScoresForGP,
  getPendingItemResolutions,
  getPendingSessionScores,
  markGPFinalized,
  updateFinalScores,
  upsertBaseScores,
} from '@/lib/data/scores'
import { getFastestLapForSession, getPredictionsForSession } from '@/lib/data/predictions'
import { getConstructorDriversMap, getResultsForSession } from '@/lib/data/session-results'
import { getItemsForGP, markItemsResolved } from '@/lib/data/items'
import { getSessionsForGP } from '@/lib/data/f1-sync'
import { computeSessionBaseScore } from '@/lib/scoring/base-score'
import { applyItemEffects } from '@/lib/scoring/resolve-items'
import { getCurrentSeason, isCronAuthorized } from '@/lib/api/cron'
import { getGPsNeedingScoreNotification, markGPNotifiedScores } from '@/lib/data/f1-sync'
import { sendPushToAll } from '@/lib/push/send'
import type { ResolutionContext } from '@/lib/scoring/types'

// Accepte GET (crons Vercel — toujours en GET) et POST (cron-job.org, curl).
async function handler(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const season = getCurrentSeason()

  try {
    let sessionsScored = 0
    let gpsFinalized   = 0

    const leagues = await getActiveLeagues(season)

    // ── Phase 1 : scores de base par ligue par session en attente ──────────
    for (const leagueId of leagues) {
      const pendingSessions = await getPendingSessionScores(leagueId)
      if (pendingSessions.length === 0) continue

      const members = await getLeagueMembers(leagueId, season)
      if (members.length === 0) continue

      for (const session of pendingSessions) {
        const [results, predictions, fastestLaps] = await Promise.all([
          getResultsForSession(session.id),
          getPredictionsForSession(session.id),
          getFastestLapForSession(session.id),
        ])

        // Résultats pas encore disponibles (confirmés côté sessions mais pas encore upsertés)
        if (results.size === 0) continue

        const userScores = members.flatMap((userId) => {
          const prediction = predictions.find((p) => p.userId === userId)
          if (!prediction) return []
          const flCode = fastestLaps.get(userId) ?? null
          const score  = computeSessionBaseScore(prediction.entries, flCode, results, session.type)
          return [{ userId, score }]
        })

        if (userScores.length === 0) continue

        await upsertBaseScores(session.id, leagueId, session.season, userScores)
        sessionsScored++
      }
    }

    // ── Phase 2 : résolution des items par GP par ligue ────────────────────
    const pendingGPs = await getPendingItemResolutions()

    for (const gp of pendingGPs) {
      // 1 requête batch pour toutes les sessions du GP (vs N getSessionId)
      const sessions       = await getSessionsForGP(gp.id)
      const sessionIdByType = new Map(sessions.map((s) => [s.type, s.id]))
      const raceSessionId  = sessionIdByType.get('race')
      const qualSessionId  = sessionIdByType.get('qualifying')

      if (!raceSessionId || !qualSessionId) continue

      const [raceResults, qualResults, constructorDrivers] = await Promise.all([
        getResultsForSession(raceSessionId),
        getResultsForSession(qualSessionId),
        getConstructorDriversMap(gp.season),
      ])

      for (const leagueId of leagues) {
        const [items, currentScores] = await Promise.all([
          getItemsForGP(gp.id, leagueId),
          getCurrentScoresForGP(gp.id, leagueId),
        ])

        if (items.length === 0) continue

        const ctx: ResolutionContext = {
          raceResults,
          qualifyingResults: qualResults,
          constructorDrivers,
          leagueId,
          gpId: gp.id,
        }

        applyItemEffects(items, currentScores, ctx)

        await Promise.all([
          updateFinalScores(gp.id, leagueId, currentScores),
          markItemsResolved(items),
        ])
      }

      await markGPFinalized(gp.id)
      gpsFinalized++
    }

    // ── Notifications "résultats disponibles" (après scoring_finalized_at) ──
    const gpsScoreNotify = await getGPsNeedingScoreNotification(season)
    for (const gp of gpsScoreNotify) {
      await sendPushToAll({
        title: `🏆 ${gp.name}`,
        body:  'Les résultats définitifs sont disponibles — vois ton score !',
        url:   '/',
      })
      await markGPNotifiedScores(gp.id)
    }

    return Response.json({ sessionsScored, gpsFinalized, notified: gpsScoreNotify.length })
  } catch (error) {
    console.error('[api/scores/trigger]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
