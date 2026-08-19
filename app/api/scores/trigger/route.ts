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
  claimSessionDeadlineNotification,
  claimSessionPostNudge,
  claimSessionProvisionalNotification,
  getGPsNeedingScoreNotification,
  getSessionsForGP,
  getSessionsNeedingDeadlineNotification,
  getSessionsNeedingPostNudge,
  markGPNotifiedScores,
} from '@/lib/data/f1-sync'
import { computeSessionBaseScore } from '@/lib/scoring/base-score'
import { applyItemEffects, buildConstructorDrivers } from '@/lib/scoring/resolve-items'
import { getCurrentSeason, isCronAuthorized } from '@/lib/api/cron'
import { isPushConfigured, sendPushToAll, sendPushToUser } from '@/lib/push/send'
import type { ResolutionContext } from '@/lib/scoring/types'

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
    let postNudgeNotified = 0

    // ── Notifications "deadline dans 1h" ──────────────────────────────────
    // Guard VAPID : ne rien claim si aucun push ne peut partir, sinon on brûlerait
    // les flags de dédup sans avoir notifié (cf. send.ts isPushConfigured).
    const pushReady = isPushConfigured()
    if (pushReady) {
      const deadlineSessions = await getSessionsNeedingDeadlineNotification(season)
      for (const session of deadlineSessions) {
        // Revendiquer l'envoi avant de pousser : dédup inter-run + pas de re-push si l'envoi échoue.
        if (!(await claimSessionDeadlineNotification(session.id))) continue
        const label = SESSION_TYPE_LABELS[session.type] ?? session.type
        // La deadline course verrouille aussi les items « avant la course » (Bloquer, bonus
        // de prédiction — product-specs §3.5) : on le rappelle explicitement sur la course.
        const body = session.type === 'race'
          ? `${session.gpName} · Dépose tes pronostics et joue ton item avant le départ !`
          : `${session.gpName} · Dépose tes pronostics avant le départ !`
        await sendPushToAll({
          title: `⏰ Deadline dans 1h — ${label}`,
          body,
          url:   `/predictions/${session.gpId}`,
        })
        deadlineNotified++
      }

      // ── Rappel "tu peux encore ajuster" (2h après chaque session non-finale) ──
      // Invite à ajuster le prono de la session suivante (ex. course avec la grille de qualif).
      const postNudgeSessions = await getSessionsNeedingPostNudge(season)
      for (const session of postNudgeSessions) {
        if (!(await claimSessionPostNudge(session.id))) continue
        const nextLabel = SESSION_TYPE_LABELS[session.nextType] ?? session.nextType
        await sendPushToAll({
          title: `✏️ ${session.gpName} — pronos ${nextLabel} encore ouverts`,
          body:  `Pense à ajuster ton pronostic ${nextLabel} tant que la session n'a pas démarré !`,
          url:   `/predictions/${session.gpId}`,
        })
        postNudgeNotified++
      }
    }

    const leagues = await getActiveLeagues(season)

    // ── Phase 1 : scores de base par ligue par session en attente ──────────
    // Set in-memory pour éviter N-1 UPDATE inutiles quand plusieurs ligues
    // scorent la même session dans le même run (claimSessionProvisionalNotification
    // est atomique mais chaque appel coûte 1 aller-retour DB).
    const claimedProvisional = new Set<string>()

    for (const leagueId of leagues) {
      const pendingSessions = await getPendingSessionScores(leagueId, season)
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

        // Notification "scores provisoires + classement mis à jour" — une seule fois par
        // session, tous appels confondus. Le claim atomique dédoublonne aussi bien les
        // ligues multiples d'un même appel que les re-runs (ex. ligue créée en cours de saison).
        if (pushReady && !claimedProvisional.has(session.id) && (await claimSessionProvisionalNotification(session.id))) {
          claimedProvisional.add(session.id)
          const label = SESSION_TYPE_LABELS[session.type] ?? session.type
          await sendPushToAll({
            title: `🏁 Scores ${label} calculés`,
            body:  'Les scores provisoires sont disponibles — le classement a été mis à jour !',
            url:   '/',
          })
          provisionalNotified++
        }
      }
    }

    // ── Phase 2 : résolution des items par GP par ligue ────────────────────
    // Guard : si aucune ligue active, on ne peut pas résoudre les items — ne pas
    // appeler markGPFinalized pour éviter de clore des GPs sans résolution.
    const pendingGPs = leagues.length > 0 ? await getPendingItemResolutions() : []

    for (const gp of pendingGPs) {
      // 1 requête batch pour toutes les sessions du GP (vs N getSessionId)
      const sessions        = await getSessionsForGP(gp.id)
      const sessionIdByType = new Map(sessions.map((s) => [s.type, s.id]))
      const raceSessionId   = sessionIdByType.get('race')
      const qualSessionId   = sessionIdByType.get('qualifying')

      if (!raceSessionId || !qualSessionId) continue

      const [raceResults, qualResults] = await Promise.all([
        getResultsForSession(raceSessionId),
        getResultsForSession(qualSessionId),
      ])

      // Duo réel de la course (#205) : dérivé des résultats — reflète remplacements
      // et échanges de baquet. Fallback mapping saison pour les courses dont les
      // résultats n'ont pas de constructor_code (antérieures à la migration).
      const raceConstructorDrivers = buildConstructorDrivers(raceResults)
      const constructorDrivers = raceConstructorDrivers.size > 0
        ? raceConstructorDrivers
        : await getConstructorDriversMap(gp.season)

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
          const p = item.payload
          if (p.type === 'block_driver' || p.type === 'wild_card') {
            gpTargetedUserIds.add(p.targetUserId)
          }
        }
      }

      await markGPFinalized(gp.id)
      gpsFinalized++

      // Notifier les utilisateurs attaqués — révélation post-course
      if (pushReady && gpTargetedUserIds.size > 0) {
        await Promise.all(
          [...gpTargetedUserIds].map((userId) => {
            itemNotified++
            return sendPushToUser(userId, {
              title: '🎮 Un item a été joué contre toi',
              body:  `${gp.name} · Un adversaire t'a ciblé — vois le résultat dans ton score !`,
              url:   '/',
            })
          }),
        )
      }
    }

    // ── Notifications "résultats disponibles" (après scoring_finalized_at) ──
    // Même guard VAPID : markGPNotifiedScores brûlerait le flag sans notifier.
    const gpsScoreNotify = pushReady ? await getGPsNeedingScoreNotification(season) : []
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
      postNudgeNotified,
    })
  } catch (error) {
    console.error('[api/scores/trigger]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
