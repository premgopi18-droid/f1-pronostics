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
import {
  getGPsNeedingScoreNotification,
  getSessionsForGP,
  getSessionsNeedingDeadlineNotification,
  markGPNotifiedScores,
  markSessionDeadlineNotified,
  markSessionProvisionalNotified,
} from '@/lib/data/f1-sync'
import { computeSessionBaseScore } from '@/lib/scoring/base-score'
import { applyItemEffects } from '@/lib/scoring/resolve-items'
import { getCurrentSeason, isCronAuthorized } from '@/lib/api/cron'
import { sendPushToAll, sendPushToUser } from '@/lib/push/send'
import type { ItemPayload, ResolutionContext } from '@/lib/scoring/types'

const SESSION_TYPE_LABELS: Record<string, string> = {
  qualifying:        'Qualifications',
  race:              'Course',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race:       'Sprint',
}

// Accepte GET (crons Vercel — toujours en GET) et POST (cron-job.org, curl).
async function handler(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const season = getCurrentSeason()

  try {
    let sessionsScored    = 0
    let gpsFinalized      = 0
    let deadlineNotified  = 0
    let provisionalNotified = 0
    let itemNotified      = 0

    // ── Notifications "deadline dans 1h" ──────────────────────────────────
    const deadlineSessions = await getSessionsNeedingDeadlineNotification(season)
    for (const session of deadlineSessions) {
      const label = SESSION_TYPE_LABELS[session.type] ?? session.type
      await sendPushToAll({
        title: `⏰ Deadline dans 1h — ${label}`,
        body:  `${session.gpName} · Dépose tes pronostics avant le départ !`,
        url:   `/predictions/${session.gpId}`,
      })
      await markSessionDeadlineNotified(session.id)
      deadlineNotified++
    }

    const leagues = await getActiveLeagues(season)

    // ── Phase 1 : scores de base par ligue par session en attente ──────────
    // Set pour ne notifier qu'une seule fois par session (plusieurs ligues peuvent
    // traiter la même session au cours du même appel).
    const notifiedProvisionalSessions = new Set<string>()

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

        // Notification "scores provisoires + classement mis à jour" — une seule fois par session
        if (!notifiedProvisionalSessions.has(session.id)) {
          notifiedProvisionalSessions.add(session.id)
          const label = SESSION_TYPE_LABELS[session.type] ?? session.type
          await Promise.all([
            sendPushToAll({
              title: `🏁 Scores ${label} calculés`,
              body:  'Les scores provisoires sont disponibles — le classement a été mis à jour !',
              url:   '/',
            }),
            markSessionProvisionalNotified(session.id),
          ])
          provisionalNotified++
        }
      }
    }

    // ── Phase 2 : résolution des items par GP par ligue ────────────────────
    const pendingGPs = await getPendingItemResolutions()

    for (const gp of pendingGPs) {
      // 1 requête batch pour toutes les sessions du GP (vs N getSessionId)
      const sessions        = await getSessionsForGP(gp.id)
      const sessionIdByType = new Map(sessions.map((s) => [s.type, s.id]))
      const raceSessionId   = sessionIdByType.get('race')
      const qualSessionId   = sessionIdByType.get('qualifying')

      if (!raceSessionId || !qualSessionId) continue

      const [raceResults, qualResults, constructorDrivers] = await Promise.all([
        getResultsForSession(raceSessionId),
        getResultsForSession(qualSessionId),
        getConstructorDriversMap(gp.season),
      ])

      // Collecter les utilisateurs ciblés par des items offensifs (toutes ligues)
      const gpTargetedUserIds = new Set<string>()

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

        // Identifier les utilisateurs ciblés par des items offensifs
        for (const item of items) {
          const p = item.payload as ItemPayload
          if (p.type === 'block_driver' || p.type === 'wild_card') {
            gpTargetedUserIds.add(p.targetUserId)
          }
        }
      }

      await markGPFinalized(gp.id)
      gpsFinalized++

      // Notifier les utilisateurs attaqués — révélation post-course
      await Promise.all(
        [...gpTargetedUserIds].map((userId) => {
          itemNotified++
          return sendPushToUser(userId, {
            title: '🎮 Un item a été joué contre toi',
            body:  `${gp.name} · Découvre quel effet ça a eu sur tes points !`,
            url:   '/',
          })
        }),
      )
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

    return Response.json({
      sessionsScored,
      gpsFinalized,
      notified: gpsScoreNotify.length,
      deadlineNotified,
      provisionalNotified,
      itemNotified,
    })
  } catch (error) {
    console.error('[api/scores/trigger]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
