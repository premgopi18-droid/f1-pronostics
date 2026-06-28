import 'server-only'
import { revalidateTag } from 'next/cache'
import {
  fetchCalendar,
  fetchConstructors,
  fetchDriverConstructorLinks,
  fetchDrivers,
  fetchQualifyingResults,
  fetchRaceResults,
  fetchSprintRaceResults,
} from '@/lib/f1/jolpica'
import { fetchSprintQualifyingResults, fetchPracticeResults } from '@/lib/f1/openf1'
import {
  confirmSessionResults,
  upsertConstructors,
  upsertDriverConstructorLinks,
  upsertDrivers,
  upsertGrandsPrix,
  upsertSessions,
} from '@/lib/data/f1-sync'
import { upsertSessionResults } from '@/lib/data/session-results'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentSeason, isCronAuthorized } from '@/lib/api/cron'
import {
  getGPsNeedingOpenNotification,
  markGPNotifiedOpen,
  getGPsNeedingQualReminder,
  markGPNotifiedQualReminder,
  getSessionsNeedingImminenceNotification,
  claimSessionImminenceNotification,
} from '@/lib/data/f1-sync'
import { isPushConfigured, sendPushToAll, sendImminencePush } from '@/lib/push/send'
import { SCOREABLE_SESSION_TYPES } from '@/lib/scoring/types'
import type { DriverResult, DbSessionType } from '@/lib/scoring/types'

// Accepte GET (crons Vercel — toujours en GET) et POST (cron-job.org, curl).
async function handler(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const seasonParam = new URL(request.url).searchParams.get('season')
  const season = seasonParam && /^\d{4}$/.test(seasonParam)
    ? Number(seasonParam)
    : getCurrentSeason()

  try {
    // ── Phase 1 : récupération des données F1 (tout en parallèle) ──────────
    const [calendar, drivers, constructors, links] = await Promise.all([
      fetchCalendar(season),
      fetchDrivers(season),
      fetchConstructors(season),
      fetchDriverConstructorLinks(season),
    ])

    // ── Phase 2 : sync base de données ─────────────────────────────────────
    await upsertConstructors(constructors)
    await upsertDrivers(drivers)
    await upsertDriverConstructorLinks(season, links)

    const gpRoundToId = await upsertGrandsPrix(calendar)

    for (const entry of calendar) {
      const gpId = gpRoundToId.get(entry.round)
      if (!gpId) continue

      const sessions: { type: DbSessionType; startsAt: string }[] = [
        { type: 'qualifying', startsAt: entry.qualifyingStartsAt },
        { type: 'race',       startsAt: entry.raceStartsAt },
      ]
      if (entry.isSprintWeekend) {
        if (entry.sprintQualStartsAt) sessions.push({ type: 'sprint_qualifying', startsAt: entry.sprintQualStartsAt })
        if (entry.sprintRaceStartsAt) sessions.push({ type: 'sprint_race',       startsAt: entry.sprintRaceStartsAt })
      }
      if (entry.practice1StartsAt) sessions.push({ type: 'practice_1', startsAt: entry.practice1StartsAt })
      if (entry.practice2StartsAt) sessions.push({ type: 'practice_2', startsAt: entry.practice2StartsAt })
      if (entry.practice3StartsAt) sessions.push({ type: 'practice_3', startsAt: entry.practice3StartsAt })
      await upsertSessions(gpId, season, sessions)
    }

    // ── Phase 3 : confirmation des sessions passées non encore confirmées ───
    const now = new Date().toISOString()
    const supabase = createServiceClient()
    const { data: pending, error: pendingError } = await supabase
      .from('sessions')
      .select('id, type, season, starts_at, grands_prix!gp_id(round)')
      .is('results_confirmed_at', null)
      .lt('starts_at', now)

    if (pendingError) throw pendingError

    let sessionsConfirmed = 0
    let writeErrors = 0

    for (const row of pending ?? []) {
      const gp = (row.grands_prix as unknown) as { round: number } | null
      if (!gp) continue

      const sessionType = row.type as DbSessionType
      const rowSeason   = row.season as number
      const round       = gp.round
      const startsAt    = row.starts_at as string

      // Isolation par session, pour la source ET les écritures (même famille de
      // bug que #121) : l'échec d'une session ne doit PAS avorter la sync ni les
      // notifs qui suivent. Le fetch source est attendu/transitoire (OpenF1 bloqué
      // en live → 403, réseau…) → on logue et on passe. Une erreur d'écriture est
      // anormale → on la compte (`writeErrors`) pour renvoyer un 500 en fin de run
      // (visibilité + retry cron, pipeline idempotent) SANS bloquer les notifs dues.
      let results: Map<string, DriverResult> | null = null
      try {
        if (sessionType === 'race') {
          results = await fetchRaceResults(rowSeason, round)
        } else if (sessionType === 'qualifying') {
          results = await fetchQualifyingResults(rowSeason, round)
        } else if (sessionType === 'sprint_race') {
          results = await fetchSprintRaceResults(rowSeason, round)
        } else if (sessionType === 'sprint_qualifying') {
          results = await fetchSprintQualifyingResults(rowSeason, startsAt)
        } else if (sessionType === 'practice_1' || sessionType === 'practice_2' || sessionType === 'practice_3') {
          const sessionName = sessionType === 'practice_1' ? 'Practice 1' : sessionType === 'practice_2' ? 'Practice 2' : 'Practice 3'
          const raw = await fetchPracticeResults(rowSeason, sessionName, startsAt)
          results = new Map(raw.map(({ driverCode, position, bestLapTime }) => [driverCode, { position, fastestLap: false, bestLapTime }]))
        }
      } catch (error) {
        console.error('[api/f1/sync] fetch résultats session', row.id, error)
        continue
      }

      // Type inconnu, ou résultats pas encore disponibles (course non terminée).
      if (!results || results.size === 0) continue

      try {
        await upsertSessionResults(row.id as string, rowSeason, results)
        await confirmSessionResults(row.id as string)
        sessionsConfirmed++
      } catch (error) {
        console.error('[api/f1/sync] écriture résultats session', row.id, error)
        writeErrors++
      }
    }

    // ── Notifications "pronostics ouverts" (48 h avant le week-end) ──────────
    // Guard VAPID : markGPNotifiedOpen brûlerait le flag de dédup sans push réel.
    const pushReady = isPushConfigured()
    const gpsToNotify = pushReady ? await getGPsNeedingOpenNotification(season) : []
    for (const gp of gpsToNotify) {
      await sendPushToAll({
        title: `🏎 ${gp.name}`,
        body:  'Le week-end commence bientôt — soumets tes pronostics !',
        url:   '/',
      })
      await markGPNotifiedOpen(gp.id)
    }

    // ── Rappel "pronos J-1" (24 h avant la 1ʳᵉ session-deadline du week-end) ──
    // Même guard VAPID : markGPNotifiedQualReminder brûlerait le flag sans push réel.
    const qualReminderGPs = pushReady ? await getGPsNeedingQualReminder(season) : []
    for (const gp of qualReminderGPs) {
      await sendPushToAll({
        title: `⏰ ${gp.name} — c'est demain`,
        body:  'Plus que 24h avant la deadline : dépose tes pronostics et joue tes items !',
        url:   `/predictions/${gp.id}`,
      })
      await markGPNotifiedQualReminder(gp.id)
    }

    // ── Notifications "session imminente" (10 min avant le début) ───────────────
    // Toutes sessions (EL incluses) ; sendImminencePush filtre par préférence user.
    const imminenceSessions = pushReady ? await getSessionsNeedingImminenceNotification(season) : []
    for (const session of imminenceSessions) {
      const isStakesSession = (SCOREABLE_SESSION_TYPES as readonly string[]).includes(session.type)
      const claimed = await claimSessionImminenceNotification(session.id)
      if (!claimed) continue
      await sendImminencePush({
        title: `🏁 ${session.gpName} — ça commence !`,
        body:  'La session débute dans moins de 10 minutes.',
        url:   '/',
      }, isStakesSession)
    }

    // Next 16 : revalidateTag exige un profil de cache (stale-while-revalidate).
    revalidateTag('drivers', 'max')
    revalidateTag('constructors', 'max')

    // Une écriture DB en échec est anormale → 500 (visibilité + retry cron), mais
    // seulement après avoir traité les autres sessions et envoyé les notifs dues.
    return Response.json(
      {
        gps: calendar.length,
        sessionsConfirmed,
        notified: gpsToNotify.length,
        qualReminders: qualReminderGPs.length,
        imminenceNotifs: imminenceSessions.length,
        writeErrors,
      },
      writeErrors > 0 ? { status: 500 } : undefined,
    )
  } catch (error) {
    console.error('[api/f1/sync]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = handler
export const POST = handler
