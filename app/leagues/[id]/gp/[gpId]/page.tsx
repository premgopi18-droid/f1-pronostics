import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { getHelmet, DEFAULT_HELMET } from '@/lib/profile/avatars'
import { buildGPFacts, countShieldedAttacksByTarget, type PlayerIdentity, type ResolvedItem } from '@/lib/items/facts'
import { buildMemberItemLines, buildSessionDetail } from '@/lib/scoring/gp-detail'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'
import {
  GPResultsClient,
  type MemberView,
  type MemberSessionDetail,
  type SessionView,
} from './gp-results-client'

const SESSION_ORDER: SessionType[] = ['sprint_qualifying', 'qualifying', 'sprint_race', 'race']

export default async function GPScoresPage({
  params,
}: {
  params: Promise<{ id: string; gpId: string }>
}) {
  const { id: leagueId, gpId } = await params
  const supabase = await createClient()
  const season   = getCurrentSeason()
  const userId   = (await headers()).get('x-user-id')!

  // Stage 1 — données de base du GP
  const [
    { data: gp },
    { data: sessions },
    { data: members },
    { data: league },
  ] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round, season, scoring_finalized_at')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, starts_at, results_confirmed_at')
      .eq('gp_id', gpId)
      .in('type', SCOREABLE_SESSION_TYPES),
    supabase
      .from('league_members')
      .select('user_id, profiles!user_id(pseudo, avatar_key, avatar_url)')
      .eq('league_id', leagueId)
      .eq('season', season),
    supabase
      .from('leagues')
      .select('id, name')
      .eq('id', leagueId)
      .single(),
  ])

  if (!gp || !league || gp.season !== season) notFound()

  const sessionIds = (sessions ?? []).map((s) => s.id as string)
  const confirmedSessions = (sessions ?? []).filter((s) => s.results_confirmed_at != null)
  const confirmedSessionIds = confirmedSessions.map((s) => s.id as string)

  // ── État des boutons d'action ──────────────────────────────────────────────
  // Items jouables jusqu'au départ de la 1ère séance ; comparaison visible dès
  // qu'une séance est verrouillée (cf. /items et /compare).
  const nowMs = new Date().getTime()
  const startTimes = (sessions ?? [])
    .map((s) => s.starts_at as string | null)
    .filter((v): v is string => v != null)
    .map((v) => new Date(v).getTime())
  const itemsDeadlinePassed = startTimes.length > 0 && Math.min(...startTimes) <= nowMs
  const anySessionLocked    = startTimes.some((time) => time <= nowMs)

  // Stage 2 — scores + pronostics/FL/résultats de TOUS les membres + items résolus
  const [
    { data: scoreRows },
    { data: predRows },
    { data: flRows },
    { data: resultRows },
    { data: itemRows },
  ] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from('scores')
          .select('user_id, session_id, final_score, exact_positions')
          .eq('league_id', leagueId)
          .eq('season', season)
          .in('session_id', sessionIds)
      : { data: [] },
    confirmedSessionIds.length > 0
      ? supabase
          .from('predictions')
          .select('user_id, session_id, entries, is_valid')
          .in('session_id', confirmedSessionIds)
      : { data: [] },
    confirmedSessionIds.length > 0
      ? supabase
          .from('fastest_lap_predictions')
          .select('user_id, session_id, drivers!driver_id(code)')
          .in('session_id', confirmedSessionIds)
      : { data: [] },
    confirmedSessionIds.length > 0
      ? supabase
          .from('session_results')
          .select('session_id, position, fastest_lap, drivers!driver_id(code)')
          .in('session_id', confirmedSessionIds)
          .not('position', 'is', null)
      : { data: [] },
    // Items résolus uniquement (resolved_at non null) → faits marquants après la course.
    supabase
      .from('items_played')
      .select('user_id, item_type, payload, was_shielded, effect_applied, points_delta_actor, points_delta_target')
      .eq('league_id', leagueId)
      .eq('gp_id', gpId)
      .not('resolved_at', 'is', null),
  ])

  const typeById = new Map((sessions ?? []).map((s) => [s.id as string, s.type as SessionType]))

  // Sessions confirmées, dans l'ordre canonique
  const orderedConfirmedTypes = SESSION_ORDER.filter((type) =>
    confirmedSessions.some((s) => s.type === type),
  )
  const sessionIdByType = new Map(confirmedSessions.map((s) => [s.type as SessionType, s.id as string]))

  // ── Maps ────────────────────────────────────────────────────────────────
  const scoreMap = new Map<string, { finalScore: number; exactPositions: number }>()
  for (const row of scoreRows ?? []) {
    const sessionType = typeById.get(row.session_id as string)
    if (!sessionType) continue
    scoreMap.set(`${row.user_id}:${sessionType}`, {
      finalScore:     row.final_score as number,
      exactPositions: row.exact_positions as number,
    })
  }

  const predBySession    = new Map<string, string[]>()   // `${userId}:${sessionId}`
  const invalidBySession = new Set<string>()
  for (const row of predRows ?? []) {
    const key = `${row.user_id}:${row.session_id}`
    if (row.is_valid) predBySession.set(key, row.entries as string[])
    else invalidBySession.add(key)
  }

  const flBySession = new Map<string, string>()
  for (const row of flRows ?? []) {
    const driver = (row.drivers as unknown) as { code: string } | null
    if (driver) flBySession.set(`${row.user_id}:${row.session_id}`, driver.code)
  }

  // Résultats officiels par session
  const resultsByCode   = new Map<string, Map<string, number>>()  // sessionId → code → pos
  const positionToCode  = new Map<string, Map<number, string>>()  // sessionId → pos → code
  const actualFL        = new Map<string, string>()               // sessionId → code
  for (const row of resultRows ?? []) {
    const driver = (row.drivers as unknown) as { code: string } | null
    if (!driver) continue
    const sid = row.session_id as string
    const pos = row.position as number
    if (!resultsByCode.has(sid))  resultsByCode.set(sid, new Map())
    if (!positionToCode.has(sid)) positionToCode.set(sid, new Map())
    resultsByCode.get(sid)!.set(driver.code, pos)
    positionToCode.get(sid)!.set(pos, driver.code)
    if (row.fastest_lap) actualFL.set(sid, driver.code)
  }

  // Identité des joueurs (pseudo + couleur du casque pour les faits marquants) +
  // avatar (clé casque + photo) pour l'affichage via UserAvatar côté client.
  const identity = new Map<string, PlayerIdentity>()
  const avatarByUser = new Map<string, { avatarKey: string | null; avatarUrl: string | null }>()
  for (const m of members ?? []) {
    const profile = (m.profiles as unknown) as { pseudo: string; avatar_key: string | null; avatar_url: string | null } | null
    identity.set(m.user_id as string, {
      pseudo: profile?.pseudo ?? '?',
      color:  (getHelmet(profile?.avatar_key) ?? DEFAULT_HELMET).color,
    })
    avatarByUser.set(m.user_id as string, {
      avatarKey: profile?.avatar_key ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    })
  }

  // Items résolus → faits marquants + lignes de détail.
  // On exclut l'historique antérieur à la migration #151 (points_delta_* à null) : sans
  // delta fiable, on n'afficherait que des « 0 » trompeurs. (Backfill OK avant lancement.)
  const resolvedItems: ResolvedItem[] = (itemRows ?? [])
    .filter((row) => row.points_delta_actor != null)
    .map((row) => ({
      userId:            row.user_id as string,
      itemType:          row.item_type as string,
      payload:           (row.payload as Record<string, unknown>) ?? {},
      wasShielded:       (row.was_shielded as boolean | null) ?? false,
      pointsDeltaActor:  row.points_delta_actor as number,
      pointsDeltaTarget: row.points_delta_target as number | null,
    }))

  // Comptage des attaques neutralisées par bouclier — calculé une fois, partagé.
  const shieldedByTarget = countShieldedAttacksByTarget(resolvedItems)
  const facts = buildGPFacts(resolvedItems, identity, shieldedByTarget)

  // ── Vues membres ──────────────────────────────────────────────────────────
  const memberViews: MemberView[] = (members ?? []).map((m) => {
    const memberId = m.user_id as string
    const info     = identity.get(memberId)!
    const itemLines = buildMemberItemLines(resolvedItems, memberId, identity, shieldedByTarget)

    const sessionsView: Partial<Record<SessionType, MemberSessionDetail>> = {}
    let total = 0
    let exactTotal = 0
    let approxTotal = 0

    for (const sessionType of orderedConfirmedTypes) {
      const sid     = sessionIdByType.get(sessionType)!
      const key     = `${memberId}:${sid}`
      const score   = scoreMap.get(`${memberId}:${sessionType}`)
      const detail  = buildSessionDetail(
        sessionType,
        predBySession.get(key),
        invalidBySession.has(key),
        resultsByCode.get(sid) ?? new Map(),
        positionToCode.get(sid) ?? new Map(),
        flBySession.get(key),
        actualFL.get(sid),
      )

      const finalScore = score?.finalScore ?? 0
      total       += finalScore
      exactTotal  += detail.exactCount
      approxTotal += detail.approxCount

      sessionsView[sessionType] = {
        finalScore,
        rows:          detail.rows,
        fastestLap:    detail.fastestLap,
        items:         itemLines.get(sessionType) ?? [],
        hasPrediction: detail.hasPrediction,
        invalid:       detail.invalid,
      }
    }

    const avatar = avatarByUser.get(memberId) ?? { avatarKey: null, avatarUrl: null }
    return {
      userId:      memberId,
      pseudo:      info.pseudo,
      avatarKey:   avatar.avatarKey,
      avatarUrl:   avatar.avatarUrl,
      isMe:        memberId === userId,
      total,
      exactTotal,
      approxTotal,
      sessions:    sessionsView,
    }
  })
  .sort((a, b) => b.total - a.total || b.exactTotal - a.exactTotal)

  const sessionViews: SessionView[] = orderedConfirmedTypes.map((type) => ({
    type,
    label: t(`predict.tab.${type}` as TranslationKey),
  }))

  const hasScores   = (scoreRows ?? []).length > 0
  const isDefinitif = gp.scoring_finalized_at != null

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-lg flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {league.name as string}
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('gpResults.round')} {gp.round} · {gp.country}
              </p>
              <h1 className="text-2xl font-bold text-foreground">{gp.name as string}</h1>
            </div>
            {hasScores && (
              <span
                className={`mt-1 shrink-0 rounded-full px-2 py-1 text-xs ${
                  isDefinitif ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                }`}
              >
                {isDefinitif ? t('gpResults.badgeDefinitif') : t('gpResults.badgeProvisoire')}
              </span>
            )}
          </div>
        </div>

        {/* Liens actions */}
        <div className="flex flex-col gap-2">
          {/* Items : toujours navigable (consultation après deadline), libellé selon l'état */}
          <Link
            href={`/leagues/${leagueId}/gp/${gpId}/items`}
            className="flex items-center justify-between rounded-xl bg-card px-4 py-3 transition-colors hover:brightness-110"
          >
            <span className="text-sm font-medium text-foreground">
              {itemsDeadlinePassed ? t('gpResults.itemsWeekend') : t('gpResults.playItem')}
            </span>
            <span className="text-xs text-muted-foreground">→</span>
          </Link>
          {/* Comparaison : désactivée + hint tant qu'aucune séance n'est verrouillée */}
          {anySessionLocked ? (
            <Link
              href={`/leagues/${leagueId}/gp/${gpId}/compare`}
              className="flex items-center justify-between rounded-xl bg-card px-4 py-3 transition-colors hover:brightness-110"
            >
              <span className="text-sm font-medium text-foreground">{t('gpResults.compareLink')}</span>
              <span className="text-xs text-muted-foreground">→</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between rounded-xl bg-card px-4 py-3 text-left opacity-50"
            >
              <span className="text-sm font-medium text-muted-foreground">{t('gpResults.compareLink')}</span>
              <span className="text-[11px] text-muted-foreground">{t('gpResults.compareLockedHint')}</span>
            </button>
          )}
        </div>

        {/* Aucun score */}
        {!hasScores && <p className="text-sm text-muted-foreground">{t('gpResults.noScores')}</p>}

        {/* Classement + faits marquants + détail */}
        {hasScores && (
          <GPResultsClient members={memberViews} sessions={sessionViews} facts={facts} revealed={isDefinitif} />
        )}

      </div>
    </main>
  )
}
