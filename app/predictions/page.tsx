import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getCurrentSeason } from '@/lib/api/cron'
import {
  getSeasonPrediction,
  getSeasonDeadlines,
  getSeasonItems,
} from '@/lib/data/season-predictions'
import { getSeasonCalendar } from '@/lib/data/results'
import { getGpHistoryScores, getCurrentGpSessionStatuses } from '@/lib/data/predictions'
import { Card, CardTitle } from '@/app/ui/card'
import { Badge } from '@/app/ui/badge'
import { buttonVariants } from '@/app/ui/button'
import { cn } from '@/lib/utils'
import { t, type TranslationKey } from '@/lib/i18n'
import type { SessionType } from '@/lib/scoring/types'

const PARIS_TZ = 'Europe/Paris'

const SESSION_LABEL: Record<SessionType, TranslationKey> = {
  qualifying:       'home.session.qualifying',
  race:             'home.session.race',
  sprint_qualifying: 'home.session.sprintQualifying',
  sprint_race:      'home.session.sprint',
}

function formatDeadline(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PARIS_TZ,
  }).format(new Date(iso))
}

export default async function PredictionsPage() {
  const userId = (await headers()).get('x-user-id')
  if (!userId) redirect('/login')

  const season = getCurrentSeason()
  const now = new Date()

  const [wdcEntries, wccEntries, seasonItems, deadlines, calendar] = await Promise.all([
    getSeasonPrediction(userId, season, 'wdc'),
    getSeasonPrediction(userId, season, 'wcc'),
    getSeasonItems(userId, season),
    getSeasonDeadlines(season, userId),
    getSeasonCalendar(season),
  ])

  const isSeasonLocked = !!(deadlines.submissionDeadline && now >= deadlines.submissionDeadline)

  const currentGp = calendar.find((gp) => gp.status === 'prochain') ?? null
  const completedGps = calendar.filter((gp) => gp.status === 'completed').reverse()

  const [currentGpSessions, historyScores] = await Promise.all([
    currentGp ? getCurrentGpSessionStatuses(userId, currentGp.id) : Promise.resolve([]),
    getGpHistoryScores(userId, season),
  ])

  return (
    <main className="flex flex-1 flex-col gap-6 px-page pb-6 pt-6">
      <h1 className="font-display text-2xl font-bold text-foreground">
        {t('nav.predictions')}
      </h1>

      {/* ── Section 1 : Pronostics saison ──────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
          {t('myPronos.seasonTitle')}
        </h2>

        <Link href="/season">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{t('myPronos.wdcTitle')}</p>
              {isSeasonLocked && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {wdcEntries ? t('myPronos.submitted') : t('myPronos.notSubmitted')}
                </p>
              )}
            </div>
            <span className="text-text-muted" aria-hidden="true">→</span>
          </Card>
        </Link>

        <Link href="/season">
          <Card padding="sm" className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{t('myPronos.wccTitle')}</p>
              {isSeasonLocked && (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {wccEntries ? t('myPronos.submitted') : t('myPronos.notSubmitted')}
                </p>
              )}
            </div>
            <span className="text-text-muted" aria-hidden="true">→</span>
          </Card>
        </Link>

        <Card>
          <p className="mb-3 text-2xs font-bold uppercase tracking-wider text-text-secondary">
            {t('myPronos.itemsTitle')}
          </p>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t('season.itemWdcName')}</span>
              <Badge variant={seasonItems.wdcMove > 0 ? 'success' : 'neutral'}>
                {seasonItems.wdcMove > 0 ? t('myPronos.itemAvailable') : t('myPronos.itemUsed')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t('season.itemWccName')}</span>
              <Badge variant={seasonItems.wccMove > 0 ? 'success' : 'neutral'}>
                {seasonItems.wccMove > 0 ? t('myPronos.itemAvailable') : t('myPronos.itemUsed')}
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Section 2 : GP en cours / prochain ─────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
          {t('myPronos.gpTitle')}
        </h2>

        {currentGp ? (
          <Card>
            <CardTitle>{currentGp.gpName}</CardTitle>

            {currentGpSessions.length > 0 && (
              <ul className="mt-3 flex flex-col">
                {currentGpSessions.map((session, index) => {
                  const status =
                    session.lockState === 'locked'
                      ? session.hasSubmitted
                        ? 'submitted'
                        : 'missed'
                      : 'open'

                  return (
                    <li
                      key={`${session.type}-${index}`}
                      className="flex items-center justify-between border-t border-border py-2.5 first:border-t-0"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {t(SESSION_LABEL[session.type])}
                      </span>
                      {status === 'submitted' && (
                        <Badge variant="success">{t('myPronos.sessionSubmitted')}</Badge>
                      )}
                      {status === 'missed' && (
                        <Badge variant="neutral">{t('myPronos.sessionMissed')}</Badge>
                      )}
                      {status === 'open' && (
                        <Badge variant="warning">
                          {t('myPronos.sessionOpen')} · {formatDeadline(session.startsAt)}
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <Link
              href={`/predictions/${currentGp.id}`}
              className={cn(buttonVariants({ size: 'block' }), 'mt-4')}
            >
              {t('home.modifyPredictions')} <span aria-hidden="true">→</span>
            </Link>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-text-secondary">{t('myPronos.noCurrentGp')}</p>
          </Card>
        )}
      </section>

      {/* ── Section 3 : Historique ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
          {t('myPronos.historyTitle')}
        </h2>

        {completedGps.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">{t('myPronos.noHistory')}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {completedGps.map((gp) => {
              const rawScore = historyScores.get(gp.id) ?? null
              return (
                <Link key={gp.id} href={`/predictions/${gp.id}/recap`}>
                  <Card padding="sm" className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{gp.gpName}</p>
                      {rawScore !== null && (
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {t('myPronos.rawScore')} :{' '}
                          <span className="font-numeric font-semibold text-foreground">
                            {rawScore}
                          </span>{' '}
                          {t('home.points')}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-text-muted" aria-hidden="true">→</span>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
