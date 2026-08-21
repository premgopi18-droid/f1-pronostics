import 'server-only'
import { revalidateTag } from 'next/cache'
import {
  fetchCalendar,
  fetchConstructors,
  fetchDriverConstructorLinks,
  fetchDrivers,
  fetchQualifyingResults,
  fetchRaceResults,
  fetchRaceLaps,
  fetchSprintRaceResults,
} from '@/lib/f1/jolpica'
import { fetchSprintQualifyingResults, fetchPracticeResults, fetchStartingGrid, fetchSessionLineup } from '@/lib/f1/openf1'
import type { GridSessionName } from '@/lib/f1/openf1'
import { GRID_SOURCE_SESSION_TYPE, type GridTargetSessionType } from '@/lib/f1/grid'
import { upsertStartingGrid } from '@/lib/data/starting-grids'
import { upsertGPLineup, getPreviousGPLineup, claimLineupChangeNotifications } from '@/lib/data/gp-lineups'
import { diffLineup, formatLineupChangeBody, selectLineupSessionCandidates, isLineupSessionTrusted } from '@/lib/data/lineup-changes'
import {
  confirmSessionResults,
  upsertConstructors,
  upsertDriverConstructorLinks,
  upsertDrivers,
  upsertGrandsPrix,
  upsertSessions,
  setRaceLaps,
} from '@/lib/data/f1-sync'
import { upsertSessionResults } from '@/lib/data/session-results'
import { shouldDeferSessionConfirmation } from '@/lib/data/session-confirmation'
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

// Sessions course dont on importe la grille de départ. La session source
// (mapping partagé GRID_SOURCE_SESSION_TYPE) joue un double rôle : une fois
// confirmée, la grille peut exister côté OpenF1, et c'est SON session_key
// qu'interroge /starting_grid (pas celui de la course — cf. lib/f1/openf1.ts).
const GRID_TARGET_TYPES: readonly GridTargetSessionType[] = ['race', 'sprint_race']
const GRID_OPENF1_SESSION: Record<GridTargetSessionType, GridSessionName> = {
  race:        'Qualifying',
  sprint_race: 'Sprint Qualifying',
}

// Détection de line-up (#205) : GPs dont la course part dans moins de 5 jours
// (= week-end en cours ou imminent), et seules les sessions démarrant dans
// moins de 24 h sont interrogées côté OpenF1 (/drivers n'apparaît qu'autour du
// début de séance — inutile d'appeler pour une session encore lointaine).
const LINEUP_RACE_WINDOW_MS      = 5 * 24 * 60 * 60 * 1000
const LINEUP_SESSION_HORIZON_MS  = 24 * 60 * 60 * 1000
const LINEUP_OPENF1_SESSION_NAME: Record<DbSessionType, string> = {
  practice_1:        'Practice 1',
  practice_2:        'Practice 2',
  practice_3:        'Practice 3',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race:       'Sprint',
  qualifying:        'Qualifying',
  race:              'Race',
}

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
      .select('id, type, season, starts_at, gp_id, grands_prix!gp_id(round)')
      .is('results_confirmed_at', null)
      .lt('starts_at', now)

    if (pendingError) throw pendingError

    let sessionsConfirmed = 0
    let sessionsDeferred = 0
    let writeErrors = 0

    for (const row of pending ?? []) {
      const gp = row.grands_prix
      if (!gp) continue

      const sessionType = row.type as DbSessionType
      const rowSeason   = row.season
      const round       = gp.round
      const startsAt    = row.starts_at

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
        const unknownDriverCodes = await upsertSessionResults(row.id, rowSeason, results)

        // Confirmation différée (#212) : le résultat contient des pilotes encore
        // absents de `drivers` (remplaçant qu'OpenF1 connaît avant Jolpica) —
        // leurs lignes ont été écartées, et une session confirmée n'est plus
        // revisitée. On retente au prochain passage (la phase 1 rattrape les
        // pilotes dès que Jolpica les liste), dans la limite de la fenêtre de
        // grâce. Essais libres uniquement — jamais les sessions scorées, sauf le
        // garde-fou absolu « aucune ligne écrite » (cf. session-confirmation.ts).
        if (shouldDeferSessionConfirmation(unknownDriverCodes, results.size, sessionType, startsAt, Date.now())) {
          sessionsDeferred++
          continue
        }

        await confirmSessionResults(row.id)
        sessionsConfirmed++
      } catch (error) {
        console.error('[api/f1/sync] écriture résultats session', row.id, error)
        writeErrors++
      }

      // Nombre de tours de la course (pour la page de pronostic, #174) : capturé à la
      // confirmation — la session ne sera plus revisitée ensuite. Isolé : un échec ici
      // n'est pas une erreur de scoring (pas de writeError), on logue et on continue.
      if (sessionType === 'race') {
        try {
          const raceLaps = await fetchRaceLaps(rowSeason, round)
          if (raceLaps != null) await setRaceLaps(row.gp_id, raceLaps)
        } catch (error) {
          console.error('[api/f1/sync] tours course', row.id, error)
        }
      }
    }

    // ── Phase 4 : grilles de départ (pré-remplissage du prono course, #200) ──
    // Fenêtre naturelle : la session course n'a pas commencé ET la session
    // source du même GP (qualif → course, sprint qualif → sprint race) est
    // confirmée. Re-synchronisée à chaque passage jusqu'au départ pour capter
    // les pénalités tardives. Phase entièrement isolée : un échec ici ne doit
    // avorter ni la sync ni les notifications.
    let gridsSynced = 0
    try {
      const { data: upcomingRaceSessions, error: upcomingError } = await supabase
        .from('sessions')
        .select('id, type, season, starts_at, gp_id')
        .in('type', [...GRID_TARGET_TYPES])
        .gt('starts_at', now)

      if (upcomingError) throw upcomingError

      const upcomingGpIds = [...new Set((upcomingRaceSessions ?? []).map((row) => row.gp_id))]
      const { data: confirmedSources, error: sourcesError } = upcomingGpIds.length > 0
        ? await supabase
            .from('sessions')
            .select('gp_id, type, starts_at')
            .in('gp_id', upcomingGpIds)
            .in('type', Object.values(GRID_SOURCE_SESSION_TYPE))
            .not('results_confirmed_at', 'is', null)
        : { data: [], error: null }

      if (sourcesError) throw sourcesError

      // gp_id:type → starts_at de la session source confirmée. Le starts_at
      // sert au rapprochement OpenF1 : /starting_grid est indexé par le
      // session_key de la session QUALIFICATIVE, on cible donc sa date.
      const confirmedSourceStarts = new Map(
        (confirmedSources ?? []).map((row) => [`${row.gp_id}:${row.type}`, row.starts_at]),
      )

      for (const row of upcomingRaceSessions ?? []) {
        const targetType = row.type as GridTargetSessionType
        const sourceStartsAt = confirmedSourceStarts.get(`${row.gp_id}:${GRID_SOURCE_SESSION_TYPE[targetType]}`)
        if (!sourceStartsAt) continue

        // Isolation par session (même politique que la phase résultats) : la
        // grille est un confort UX, pas une donnée de scoring — on logue et on
        // passe, le cron retentera au prochain passage.
        try {
          const grid = await fetchStartingGrid(row.season, GRID_OPENF1_SESSION[targetType], sourceStartsAt)
          if (grid.size === 0) continue
          await upsertStartingGrid(row.id, row.season, grid)
          gridsSynced++
        } catch (error) {
          console.error('[api/f1/sync] grille de départ session', row.id, error)
        }
      }
    } catch (error) {
      console.error('[api/f1/sync] phase grilles de départ', error)
    }

    // Guard VAPID commun aux notifications : les marks/claims brûleraient les
    // flags de dédup sans push réel.
    const pushReady = isPushConfigured()

    // ── Phase 5 : line-ups + notif « changement de line-up » (#205) ─────────
    // Un pilote qui roule pour une autre écurie que lors du GP précédent
    // (échange de baquet, réserviste) déclenche un push agrégé AVANT la course,
    // pendant que pronos et items sont encore jouables. Détection : /drivers
    // OpenF1 de la session la plus récente déjà disponible (EL1 dès le vendredi,
    // course le dimanche), diffé contre le line-up du GP précédent — même source des
    // deux côtés, les libellés d'écurie OpenF1 ne matchant ni nos codes ni les
    // noms Jolpica. Dédup par claim atomique par pilote (gp_lineups.notified_at) :
    // un 2ᵉ remplacement le dimanche matin renotifie. Le line-up est upserté
    // même sans VAPID (baseline du GP suivant). Phase entièrement isolée.
    let lineupNotifs = 0
    try {
      const raceWindowEnd = new Date(Date.now() + LINEUP_RACE_WINDOW_MS).toISOString()
      const { data: upcomingRaces, error: upcomingRacesError } = await supabase
        .from('sessions')
        .select('gp_id, grands_prix!gp_id(id, name, season, round, is_cancelled)')
        .eq('type', 'race')
        .gt('starts_at', now)
        .lte('starts_at', raceWindowEnd)

      if (upcomingRacesError) throw upcomingRacesError

      for (const raceRow of upcomingRaces ?? []) {
        const gp = raceRow.grands_prix
        if (!gp || gp.is_cancelled) continue

        // Isolation par GP (même politique que les grilles) : la notif line-up
        // est un confort, un échec ne doit pas avorter la sync ni les notifs.
        try {
          // Sessions du GP dans l'horizon OpenF1, de la plus récente à la plus
          // ancienne (sélection pure, testée) : la plus fraîche disponible fait
          // foi — indispensable pour capter un remplacement du dimanche matin.
          const { data: gpSessions, error: gpSessionsError } = await supabase
            .from('sessions')
            .select('type, starts_at')
            .eq('gp_id', gp.id)

          if (gpSessionsError) throw gpSessionsError

          const candidates = selectLineupSessionCandidates(
            (gpSessions ?? []).map((session) => ({ type: session.type, startsAt: session.starts_at })),
            Date.now(),
            LINEUP_SESSION_HORIZON_MS,
          )

          let lineup = new Map<string, string>()
          let lineupFromTrustedSession = false
          for (const session of candidates) {
            lineup = await fetchSessionLineup(
              gp.season,
              LINEUP_OPENF1_SESSION_NAME[session.type as DbSessionType],
              session.startsAt,
            )
            if (lineup.size > 0) {
              lineupFromTrustedSession = isLineupSessionTrusted(session.startsAt, Date.now())
              break
            }
          }
          if (lineup.size === 0) continue

          await upsertGPLineup(gp.id, gp.season, lineup, lineupFromTrustedSession)
          if (!pushReady) continue

          const previousLineup = await getPreviousGPLineup(gp.season, gp.round)
          const changes = diffLineup(previousLineup, lineup)
          if (changes.length === 0) continue

          const claimed = await claimLineupChangeNotifications(
            gp.id,
            gp.season,
            changes.map((change) => change.driverCode),
          )
          if (claimed.length === 0) continue

          const teamByCode = new Map(changes.map((change) => [change.driverCode, change.to]))
          await sendPushToAll({
            title: `🔄 ${gp.name} — changement de line-up`,
            body:  formatLineupChangeBody(claimed.map((driver) => ({
              displayName: driver.lastName,
              teamName:    teamByCode.get(driver.code)!,
            }))),
            url:   `/predictions/${gp.id}`,
          })
          lineupNotifs++
        } catch (error) {
          console.error('[api/f1/sync] line-up GP', gp.id, error)
        }
      }
    } catch (error) {
      console.error('[api/f1/sync] phase line-ups', error)
    }

    // ── Notifications "pronostics ouverts" (48 h avant le week-end) ──────────
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
        sessionsDeferred,
        gridsSynced,
        lineupNotifs,
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
