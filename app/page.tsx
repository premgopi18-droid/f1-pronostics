import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { PushSubscribe } from '@/app/components/push-subscribe'
import { UserAvatar } from '@/app/components/user-avatar'
import { buttonVariants } from '@/app/ui/button'
import { Card, CardTitle } from '@/app/ui/card'
import { Countdown } from '@/app/components/countdown'
import { PreviousGpCard } from '@/app/components/previous-gp-card'
import { GpWeekendCard } from '@/app/components/gp-weekend-card'
import { getPreviousGpCard, getCurrentGpView } from '@/lib/data/home'
import { getCurrentGp } from '@/lib/data/current-gp'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

export default async function HomePage() {
  const supabase = await createClient()
  const season = getCurrentSeason()
  const userId = (await headers()).get('x-user-id')!

  const [{ data: profile }, { data: memberships }, nextGP, previousGp] = await Promise.all([
    supabase.from('profiles').select('pseudo, avatar_key, avatar_url').eq('id', userId).single(),
    supabase
      .from('league_members')
      .select('league_id, leagues!league_id ( name )')
      .eq('user_id', userId)
      .eq('season', season),
    getCurrentGp(season),
    getPreviousGpCard(userId, season),
  ])

  const pseudo = profile?.pseudo ?? ''
  const leagues = (memberships ?? []).map((m) => {
    const league = m.leagues as unknown as { name: string } | null
    return { id: m.league_id as string, name: league?.name ?? 'Ligue sans nom' }
  })

  // Phase du GP courant (countdown / week-end / live / calcul) + ses sessions.
  const gpView = nextGP
    ? await getCurrentGpView(nextGP.id, nextGP.weekendStartsAt)
    : null
  const phase = gpView?.phase ?? 'upcoming'

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
          <UserAvatar avatarKey={profile?.avatar_key ?? null} avatarUrl={profile?.avatar_url ?? null} size={40} label={pseudo} />
        </Link>
      </div>

      {/* GP courant — countdown / week-end / live / calcul */}
      {nextGP ? (
        <>
          {phase === 'live' && (
            <div className="flex items-center gap-2 rounded-xl border border-primary bg-accent-soft px-3.5 py-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-primary [animation:bx-blink_1.1s_infinite] motion-reduce:[animation:none]"
                aria-hidden
              />
              <span className="text-sm font-semibold text-foreground">{t('home.liveLabel')}</span>
            </div>
          )}
          {phase === 'processing' && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
              <span
                className="h-4 w-4 rounded-full border-2 border-border border-t-primary [animation:bx-spin_.8s_linear_infinite] motion-reduce:[animation:none]"
                aria-hidden
              />
              <span className="text-sm text-text-secondary">{t('home.processing')}</span>
            </div>
          )}

          {phase === 'upcoming' ? (
            <Card variant="gradient">
              <div className="text-2xs font-bold uppercase tracking-wider text-primary">
                {t('home.nextGpLabel')}
              </div>
              <CardTitle className="mt-2 text-2xl">{nextGP.name}</CardTitle>
              <div className="mt-1 text-sm text-text-secondary">
                {t('home.round')} {nextGP.round} · {nextGP.country}
              </div>
              {nextGP.weekendStartsAt && (
                <div className="mt-4">
                  <Countdown targetIso={nextGP.weekendStartsAt} />
                </div>
              )}
              <Link
                href={`/predictions/${nextGP.id}`}
                className={cn(buttonVariants({ size: 'block' }), 'mt-4')}
              >
                {t('home.predict')} <span aria-hidden="true">→</span>
              </Link>
              {/* Lien résultats : dispo dès que le week-end produit des données
                  (EL confirmées) → consulter les EL avant le verrou Q1. */}
              {gpView?.hasResults && (
                <Link
                  href={`/results/${nextGP.id}`}
                  className="mt-3 inline-flex w-full justify-center text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {t('home.viewResults')} <span aria-hidden="true">›</span>
                </Link>
              )}
            </Card>
          ) : phase === 'weekend' || phase === 'live' ? (
            // En week-end/live, des sessions restent ouvertes → card sessions (CTA pertinent).
            // En processing, tout est verrouillé → seule la bannière « Calcul » ci-dessus s'affiche.
            <GpWeekendCard
              name={nextGP.name}
              gpId={nextGP.id}
              sessions={gpView?.sessions ?? []}
              hasResults={gpView?.hasResults ?? false}
            />
          ) : null}
        </>
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
    </main>
  )
}
