import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Settings } from 'lucide-react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { t } from '@/lib/i18n'
import { getCountryCode } from '@/lib/f1/country-codes'
import { findUpcomingGp, findCurrentOrLastGp, getLastFinalizedGps } from '@/lib/leagues/league-detail'
import { LeaderboardRealtime } from './leaderboard-realtime'
import { buildStandings } from '@/lib/leagues/standings'
import { ItemBubble } from '@/app/components/item-bubble'
import { GP_ITEM_TYPES, type GpItemType } from '@/lib/leagues/league-list'
import type { MemberRow, ScoreRow, SeasonScoreRow, Standing } from '@/lib/leagues/standings'

function formatDeadline(startsAt: string): string {
  const date = new Date(startsAt)
  // Fuseau épinglé : rendu côté serveur (UTC sur Vercel) sinon l'heure affichée serait fausse.
  const day = date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'Europe/Paris' })
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  return `${day}. ${time}`
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const season = getCurrentSeason()
  const supabase = await createClient()
  const userId = (await headers()).get('x-user-id')!
  const now = new Date()

  const [
    { data: league },
    { data: rawMembers },
    { data: scoreRows },
    { data: seasonRows },
    { data: grandsPrix },
    { data: nextQualifying },
    { data: myItems },
    { data: myScoreRows },
  ] = await Promise.all([
    supabase
      .from('leagues')
      .select('id, name, invite_code, invite_open')
      .eq('id', id)
      .single(),
    supabase
      .from('league_members')
      .select('user_id, is_admin, profiles!user_id ( pseudo, avatar_key )')
      .eq('league_id', id)
      .eq('season', season),
    supabase
      .from('scores')
      .select('user_id, final_score, exact_positions')
      .eq('league_id', id)
      .eq('season', season),
    supabase
      .from('season_scores')
      .select('user_id, total')
      .eq('league_id', id)
      .eq('season', season),
    supabase
      .from('grands_prix')
      .select('id, name, country, round, scoring_finalized_at, weekend_starts_at')
      .eq('season', season)
      .eq('is_cancelled', false)
      .order('round', { ascending: false }),
    // Prochaine session de qualifications — pour la bannière deadline
    supabase
      .from('sessions')
      .select('starts_at, gp_id')
      .eq('type', 'qualifying')
      .gt('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })
      .limit(1),
    // Items de l'utilisateur dans cette ligue
    supabase
      .from('user_items')
      .select('item_type, uses_remaining')
      .eq('user_id', userId)
      .eq('league_id', id)
      .eq('season', season),
    // Scores de l'utilisateur avec join sessions → pour l'aperçu par GP
    supabase
      .from('scores')
      .select('final_score, sessions!session_id(gp_id)')
      .eq('user_id', userId)
      .eq('league_id', id)
      .eq('season', season),
  ])

  if (!league) notFound()

  // --- Classement ---
  const members: MemberRow[] = (rawMembers ?? []).map((m) => {
    const profile = (m.profiles as unknown) as { pseudo: string; avatar_key: string | null } | null
    return {
      user_id: m.user_id as string,
      is_admin: m.is_admin as boolean,
      profile: { pseudo: profile?.pseudo ?? '?', avatarKey: profile?.avatar_key ?? null },
    }
  })
  const normalizedSeasonScores: SeasonScoreRow[] = (seasonRows ?? []).map((r) => ({
    user_id: r.user_id as string,
    total: r.total as number,
  }))
  const initialStandings: Standing[] = buildStandings(
    members,
    (scoreRows ?? []) as ScoreRow[],
    normalizedSeasonScores,
  )
  const isAdmin = members.some((m) => m.user_id === userId && m.is_admin)
  const memberCount = members.length

  // --- Items ---
  const itemsByType = new Map<GpItemType, number>()
  for (const item of myItems ?? []) {
    itemsByType.set(item.item_type as GpItemType, item.uses_remaining as number)
  }

  // --- Aperçu saison ---
  const gpList = grandsPrix ?? []
  const myGpScores = new Map<string, number>()
  for (const row of myScoreRows ?? []) {
    // scores → sessions est une relation to-one : PostgREST renvoie un objet, pas un tableau.
    const session = ((row as unknown) as { final_score: number; sessions: { gp_id: string } | null }).sessions
    const gpId = session?.gp_id
    if (!gpId) continue
    myGpScores.set(gpId, (myGpScores.get(gpId) ?? 0) + (row.final_score as number))
  }
  const lastFinalized = getLastFinalizedGps(gpList as Parameters<typeof getLastFinalizedGps>[0], 3)

  // GP ciblé par le lien « pronos verrouillés » — le plus récent dont le weekend a commencé.
  const compareGp = findCurrentOrLastGp(gpList as Parameters<typeof findCurrentOrLastGp>[0], now)

  // --- Deadline ---
  const upcomingGp = findUpcomingGp(gpList as Parameters<typeof findUpcomingGp>[0], now)
  const qualifying = (nextQualifying ?? [])[0]
  const deadlineString = qualifying?.starts_at ? formatDeadline(qualifying.starts_at as string) : null

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <Link
          href="/leagues"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-foreground transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <div className="flex flex-1 flex-col gap-0">
          <h1 className="font-display text-xl font-bold leading-tight text-foreground">
            {league.name as string}
          </h1>
          <p className="text-xs text-text-secondary">
            {memberCount} {t('leagues.members')} · {t('leagueDetail.season')} {season}
          </p>
        </div>
        {isAdmin && (
          <Link
            href={`/leagues/${id}/admin`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-text-secondary transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={t('admin.pageTitle')}
          >
            <Settings size={18} aria-hidden />
          </Link>
        )}
      </div>

      {/* Bannière deadline */}
      {deadlineString && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary/15 px-4 py-2.5 text-sm">
          <span aria-hidden>🏁</span>
          <span className="text-foreground">
            <span className="font-semibold">{t('leagueDetail.deadlineLabel')}</span>
            {' · '}
            {deadlineString}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Classement en temps réel */}
        <LeaderboardRealtime
          initialStandings={initialStandings}
          members={members}
          seasonScores={normalizedSeasonScores}
          leagueId={id}
          season={season}
          currentUserId={userId}
        />

        {/* Mes items disponibles */}
        <section aria-labelledby="items-heading">
          <h2
            id="items-heading"
            className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary"
          >
            {t('leagueDetail.myItemsTitle')}
          </h2>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="overflow-x-auto pb-0.5 scrollbar-none">
              <div
                className="mx-auto flex w-max gap-3"
                role="list"
                aria-label={t('leagues.itemsAvailable')}
              >
                {GP_ITEM_TYPES.map((itemType) => (
                  <div key={itemType} role="listitem">
                    <ItemBubble
                      itemType={itemType}
                      usesRemaining={itemsByType.get(itemType) ?? 0}
                    />
                  </div>
                ))}
              </div>
            </div>
            {upcomingGp && (
              <Link
                href={`/leagues/${id}/gp/${upcomingGp.id}/items`}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span aria-hidden>🎮</span>
                {t('leagueDetail.playItem')}
              </Link>
            )}
          </div>
        </section>

        {/* Aperçu saison */}
        {lastFinalized.length > 0 && (
          <section aria-labelledby="preview-heading">
            <h2
              id="preview-heading"
              className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary"
            >
              {t('leagueDetail.seasonPreviewTitle')}
            </h2>
            <div className="flex flex-col gap-2">
              {lastFinalized.map((gp) => (
                <Link
                  key={gp.id}
                  href={`/leagues/${id}/gp/${gp.id}`}
                  className="flex items-center gap-4 rounded-xl bg-card px-4 py-3 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="flex flex-col items-center w-8 shrink-0">
                    <span className="font-numeric text-sm font-bold text-text-secondary">
                      {getCountryCode(gp.country)}
                    </span>
                    <span className="text-2xs text-text-muted truncate w-full text-center">
                      {gp.country}
                    </span>
                  </div>
                  <span className="font-numeric text-lg font-bold text-gold tabular-nums">
                    {myGpScores.get(gp.id) ?? 0}{' '}
                    <span className="text-sm font-semibold text-text-secondary">
                      {t('leagueDetail.pts')}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="#gps"
              className="mt-3 block text-center text-sm text-text-secondary transition-colors hover:text-foreground"
            >
              {t('leagueDetail.allGps')}
            </Link>
          </section>
        )}

        {/* Pronos verrouillés — compare du GP en cours / dernier GP commencé */}
        {compareGp && (
          <Link
            href={`/leagues/${id}/gp/${compareGp.id}/compare`}
            className="flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('leagueDetail.lockedPredictions')}
          </Link>
        )}

        {/* Liste complète des GPs */}
        {gpList.length > 0 && (
          <section id="gps" aria-labelledby="gps-heading">
            <h2
              id="gps-heading"
              className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary"
            >
              {t('leagueDetail.weekendsTitle')}
            </h2>
            <div className="flex flex-col gap-1.5">
              {gpList.map((gp) => {
                const isPast = new Date(gp.weekend_starts_at as string) < now
                const isNext = gp.id === upcomingGp?.id
                return (
                  <Link
                    key={gp.id as string}
                    href={isPast ? `/leagues/${id}/gp/${gp.id}` : `/predictions/${gp.id}`}
                    className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="w-6 shrink-0 text-right font-numeric text-xs tabular-nums text-text-muted">
                      R{gp.round}
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {gp.name as string}
                    </span>
                    {gp.scoring_finalized_at != null ? (
                      <span className="text-2xs font-semibold text-success">{t('leagueDetail.gpStatusFinal')}</span>
                    ) : isPast ? (
                      <span className="text-2xs font-semibold text-warning">{t('leagueDetail.gpStatusProvisional')}</span>
                    ) : isNext ? (
                      <span className="text-2xs font-semibold text-primary">{t('leagueDetail.gpStatusNext')}</span>
                    ) : (
                      <span className="text-2xs font-semibold text-text-muted">{t('leagueDetail.gpStatusUpcoming')}</span>
                    )}
                    <span className="text-xs text-text-muted">→</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
