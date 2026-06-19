import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { InviteLink } from './invite-link'
import { AdminPanel } from './admin-panel'
import { LeaderboardRealtime } from './leaderboard-realtime'
import { buildStandings } from '@/lib/leagues/standings'
import type { MemberRow, ScoreRow, SeasonScoreRow, Standing } from '@/lib/leagues/standings'

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const season  = getCurrentSeason()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Ligue (RLS : visible uniquement par les membres)
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, invite_code, invite_open')
    .eq('id', id)
    .single()

  if (!league) notFound()

  // Requêtes séparées — pas de FK league_members → scores/season_scores, join impossible
  // via PostgREST. Formule de classement (data-model.md) : SUM(scores.final_score) +
  // season_scores.total (bonus WDC/WCC de fin de saison, 1 ligne par user).
  const [{ data: rawMembers }, { data: scoreRows }, { data: seasonRows }, { data: grandsPrix }] = await Promise.all([
    supabase
      .from('league_members')
      .select('user_id, is_admin, profiles!user_id ( pseudo, avatar_key, is_deleted )')
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
  ])

  // Normalisation des membres pour le Client Component (types sérialisables)
  const members: MemberRow[] = (rawMembers ?? []).map((m) => {
    const profile = (m.profiles as unknown) as { pseudo: string; avatar_key: string | null; is_deleted: boolean } | null
    return {
      user_id:  m.user_id as string,
      is_admin: m.is_admin as boolean,
      profile: {
        pseudo:    profile?.is_deleted ? 'Compte supprimé' : (profile?.pseudo ?? '?'),
        avatarKey: profile?.avatar_key ?? null,
        isDeleted: profile?.is_deleted ?? false,
      },
    }
  })

  const normalizedSeasonScores: SeasonScoreRow[] = (seasonRows ?? []).map((r) => ({
    user_id: r.user_id as string,
    total:   r.total as number,
  }))

  const isAdmin = (rawMembers ?? []).some(
    (m) => m.user_id === user.id && m.is_admin,
  )

  // Calcul initial côté serveur (SSR) — même agrégation/tri que le flux Realtime.
  // Le Client Component le reçoit en initialStandings, puis recalcule via buildStandings.
  const initialStandings: Standing[] = buildStandings(
    members,
    (scoreRows ?? []) as ScoreRow[],
    normalizedSeasonScores,
  )

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Mes ligues
          </Link>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
        </div>

        {/* Lien d'invitation */}
        <InviteLink
          code={league.invite_code as string}
          inviteOpen={league.invite_open as boolean}
        />

        {/* Classement — temps réel via Supabase Realtime */}
        <LeaderboardRealtime
          initialStandings={initialStandings}
          members={members}
          seasonScores={normalizedSeasonScores}
          leagueId={id}
          season={season}
          currentUserId={user.id}
        />

        {/* Panel admin */}
        {isAdmin && (
          <AdminPanel
            leagueId={id}
            inviteOpen={league.invite_open as boolean}
          />
        )}

        {/* Week-ends */}
        {(grandsPrix ?? []).length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Week-ends</h2>
            <div className="flex flex-col gap-1">
              {(grandsPrix ?? []).map((gp) => {
                const isPast = new Date(gp.weekend_starts_at as string) < new Date()
                return (
                  <Link
                    key={gp.id as string}
                    href={`/leagues/${id}/gp/${gp.id}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors ${!isPast ? 'opacity-40' : ''}`}
                  >
                    <span className="text-zinc-500 text-xs w-6 text-right tabular-nums">R{gp.round}</span>
                    <span className="flex-1 text-white text-sm font-medium">{gp.name as string}</span>
                    {gp.scoring_finalized_at != null ? (
                      <span className="text-xs text-emerald-400">Définitif</span>
                    ) : isPast ? (
                      <span className="text-xs text-amber-400">Provisoire</span>
                    ) : null}
                    <span className="text-zinc-600 text-xs">→</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
