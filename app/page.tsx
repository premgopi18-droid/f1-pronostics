import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { signOut } from '@/app/actions/auth'
import { PushSubscribe } from '@/app/components/push-subscribe'
import { UserAvatar } from '@/app/components/user-avatar'
import { buttonVariants } from '@/app/ui/button'
import { Card, CardTitle } from '@/app/ui/card'
import { Countdown } from '@/app/components/countdown'
import { PreviousGpCard } from '@/app/components/previous-gp-card'
import { getPreviousGpCard } from '@/lib/data/home'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

export default async function HomePage() {
  const supabase = await createClient()
  const season = getCurrentSeason()
  const userId = (await headers()).get('x-user-id')!

  const [{ data: profile }, { data: memberships }, { data: nextGP }, previousGp] = await Promise.all([
    supabase.from('profiles').select('pseudo, avatar_key').eq('id', userId).single(),
    supabase
      .from('league_members')
      .select('league_id, leagues!league_id ( name )')
      .eq('user_id', userId)
      .eq('season', season),
    supabase
      .from('grands_prix')
      .select('id, name, country, round, weekend_starts_at')
      .eq('season', season)
      .eq('is_cancelled', false)
      .is('scoring_finalized_at', null)
      .order('round', { ascending: true })
      .limit(1)
      .maybeSingle(),
    getPreviousGpCard(userId, season),
  ])

  const pseudo = profile?.pseudo ?? ''
  const leagues = (memberships ?? []).map((m) => {
    const league = m.leagues as unknown as { name: string } | null
    return { id: m.league_id as string, name: league?.name ?? 'Ligue sans nom' }
  })

  return (
    <main className="flex flex-1 flex-col gap-6 px-page pb-6 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-text-secondary">{t('home.greeting')}</div>
          <div className="font-display text-2xl font-bold text-foreground">{pseudo}</div>
        </div>
        <Link
          href="/profile"
          aria-label={t('nav.profile')}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar avatarKey={profile?.avatar_key ?? null} size={40} label={pseudo} />
        </Link>
      </div>

      {/* Card prochain GP */}
      {nextGP ? (
        <Card variant="gradient">
          <div className="text-2xs font-bold uppercase tracking-wider text-primary">
            {t('home.nextGpLabel')}
          </div>
          <CardTitle className="mt-2 text-2xl">{nextGP.name as string}</CardTitle>
          <div className="mt-1 text-sm text-text-secondary">
            {t('home.round')} {nextGP.round as number} · {nextGP.country as string}
          </div>
          {nextGP.weekend_starts_at && (
            <div className="mt-4">
              <Countdown targetIso={nextGP.weekend_starts_at as string} />
            </div>
          )}
          <Link
            href={`/predictions/${nextGP.id as string}`}
            className={cn(buttonVariants({ size: 'block' }), 'mt-4')}
          >
            {t('home.predict')} <span aria-hidden="true">→</span>
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-text-secondary">{t('home.noNextGp')}</p>
        </Card>
      )}

      {/* Card dernier GP — podium officiel + score brut global */}
      {previousGp && <PreviousGpCard card={previousGp} />}

      {/* CTAs ligues */}
      <div className="flex gap-2.5">
        <Link
          href="/leagues/new"
          className={cn(buttonVariants({ variant: 'secondary', size: 'block' }), 'flex-1')}
        >
          {t('home.createLeague')}
        </Link>
        <Link
          href="/leagues/join"
          className={cn(buttonVariants({ variant: 'secondary', size: 'block' }), 'flex-1')}
        >
          {t('home.joinLeague')}
        </Link>
      </div>

      {/* Accès rapides — temporaires : déménageront dans les onglets dédiés (#47 Ligues, #45 Pronos, #51 Profil) */}
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
          {t('home.myLeagues')}
        </h2>
        {leagues.length > 0 ? (
          <div className="flex flex-col gap-2">
            {leagues.map((league) => (
              <Link key={league.id} href={`/leagues/${league.id}`}>
                <Card padding="sm" className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{league.name}</span>
                  <span className="text-text-muted">→</span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="text-center">
            <p className="font-semibold text-foreground">{t('home.noLeaguesTitle')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('home.noLeaguesText')}</p>
          </Card>
        )}

        <Link href="/season">
          <Card padding="sm" className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t('home.seasonLink')}</span>
            <span className="text-text-muted">→</span>
          </Card>
        </Link>

        <PushSubscribe />
      </div>

      {/* Déconnexion — déménagera dans le profil (#51) */}
      <form action={signOut} className="mt-auto pt-2">
        <button
          type="submit"
          className="text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          {t('home.signOut')}
        </button>
      </form>
    </main>
  )
}
