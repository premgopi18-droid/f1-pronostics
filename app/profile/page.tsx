import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { t } from '@/lib/i18n'
import { UserAvatar } from '@/app/components/user-avatar'
import { ProfileSettings } from './profile-settings'
import { signOut } from '@/app/actions/auth'

export default async function ProfilePage() {
  const supabase = await createClient()
  const userId   = (await headers()).get('x-user-id')!
  const season   = getCurrentSeason()

  const [
    { data: profile },
    { data: leagueMemberships },
    { data: scores },
  ] = await Promise.all([
    supabase.from('profiles').select('pseudo, avatar_key').eq('id', userId).single(),
    supabase.from('league_members').select('league_id').eq('user_id', userId).eq('season', season),
    supabase.from('scores').select('final_score').eq('user_id', userId).eq('season', season),
  ])

  if (!profile) notFound()

  const leagueCount  = leagueMemberships?.length ?? 0
  const seasonPoints = (scores ?? []).reduce((sum, row) => sum + (row.final_score ?? 0), 0)

  const leagueLabel =
    leagueCount <= 1 ? t('profile.statsLeague') : t('profile.statsLeaguePlural')

  return (
    <main className="flex flex-1 flex-col pb-6 px-page pt-8">
      {/* Header avatar + stats */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <UserAvatar
          avatarKey={profile.avatar_key as string | null}
          size={80}
          label={profile.pseudo as string}
        />
        <div className="flex flex-col items-center gap-1">
          <p className="font-display text-2xl font-bold text-foreground">
            {profile.pseudo as string}
          </p>
          <p className="text-sm text-muted-foreground">
            {leagueCount} {leagueLabel} · {seasonPoints} {t('profile.statsPts')}
          </p>
        </div>
      </div>

      {/* Settings rows */}
      <ProfileSettings />

      {/* Déconnexion */}
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-2xl bg-card py-3.5 text-center text-sm font-semibold text-destructive transition-colors hover:bg-card/80 active:scale-[0.98]"
        >
          {t('profile.signOut')}
        </button>
      </form>
    </main>
  )
}
