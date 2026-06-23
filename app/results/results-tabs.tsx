'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardTitle } from '@/app/ui/card'
import { t } from '@/lib/i18n'

type Tab = 'calendar' | 'drivers' | 'teams'
type GpStatus = 'completed' | 'prochain' | 'predictable' | 'upcoming'

export type CalendarGpView = {
  id: string
  countryCode: string
  displayName: string
  gpName: string
  status: GpStatus
  winner: string | null
  formattedQualiTime: string | null
  formattedRaceTime: string | null
  formattedDate: string | null
}

const TABS: { id: Tab; label: () => string }[] = [
  { id: 'calendar', label: () => t('results.tabCalendar') },
  { id: 'drivers',  label: () => t('results.tabDrivers') },
  { id: 'teams',    label: () => t('results.tabTeams') },
]

interface Props {
  gps: CalendarGpView[]
}

export function ResultsTabs({ gps }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('calendar')

  const prochain = gps.find((gp) => gp.status === 'prochain') ?? null
  const rest = gps.filter((gp) => gp.status !== 'prochain')

  return (
    <div className="flex flex-1 flex-col">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('nav.results')}
        className="mx-page mb-4 flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`results-tabpanel-${tab.id}`}
            id={`results-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-text-secondary hover:text-foreground',
            )}
          >
            {tab.label()}
          </button>
        ))}
      </div>

      {/* Calendrier */}
      {activeTab === 'calendar' && (
        <div
          role="tabpanel"
          id="results-tabpanel-calendar"
          aria-labelledby="results-tab-calendar"
          className="flex flex-1 flex-col gap-3 px-page"
        >
          {!prochain && rest.length === 0 && (
            <p className="text-sm text-text-secondary">{t('results.noCalendar')}</p>
          )}

          {/* PROCHAIN hero */}
          {prochain && (
            <Card variant="gradient">
              <div className="text-2xs font-bold uppercase tracking-wider text-primary">
                {t('results.badgeProchain')}
              </div>
              <div className="mt-2 flex items-start gap-3">
                <CountryBadge code={prochain.countryCode} />
                <div className="min-w-0">
                  <CardTitle className="text-xl leading-tight">{prochain.gpName}</CardTitle>
                  {(prochain.formattedQualiTime || prochain.formattedRaceTime) && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {prochain.formattedQualiTime && (
                        <span>{t('results.qualiLabel')} {prochain.formattedQualiTime}</span>
                      )}
                      {prochain.formattedQualiTime && prochain.formattedRaceTime && (
                        <span> · </span>
                      )}
                      {prochain.formattedRaceTime && (
                        <span>{t('results.raceLabel')} {prochain.formattedRaceTime}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Liste des autres GPs */}
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {rest.map((gp, i) => (
                <div
                  key={gp.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5',
                    i < rest.length - 1 && 'border-b border-border',
                  )}
                >
                  <CountryBadge code={gp.countryCode} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">{gp.displayName}</div>
                    {gp.status === 'completed' && gp.winner && (
                      <div className="text-xs text-text-secondary">
                        {t('results.winner')} · {gp.winner}
                      </div>
                    )}
                    {(gp.status === 'predictable' || gp.status === 'upcoming') &&
                      gp.formattedDate && (
                        <div className="text-xs text-text-secondary">{gp.formattedDate}</div>
                      )}
                  </div>
                  <div className="shrink-0">
                    {gp.status === 'completed' && (
                      <Link
                        href={`/results/${gp.id}`}
                        className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        aria-label={`${t('results.linkResults')} — ${gp.displayName}`}
                      >
                        {t('results.linkResults')} ›
                      </Link>
                    )}
                    {gp.status === 'predictable' && (
                      <Link
                        href={`/predictions/${gp.id}`}
                        className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        aria-label={`${t('results.linkPredict')} — ${gp.displayName}`}
                      >
                        {t('results.linkPredict')} ›
                      </Link>
                    )}
                    {gp.status === 'upcoming' && (
                      <span className="text-xs text-text-muted">{t('results.upcoming')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pilotes placeholder */}
      {activeTab === 'drivers' && (
        <div
          role="tabpanel"
          id="results-tabpanel-drivers"
          aria-labelledby="results-tab-drivers"
          className="flex flex-1 items-center justify-center px-page"
        >
          <p className="text-sm text-text-secondary">{t('common.comingSoon')}</p>
        </div>
      )}

      {/* Écuries placeholder */}
      {activeTab === 'teams' && (
        <div
          role="tabpanel"
          id="results-tabpanel-teams"
          aria-labelledby="results-tab-teams"
          className="flex flex-1 items-center justify-center px-page"
        >
          <p className="text-sm text-text-secondary">{t('common.comingSoon')}</p>
        </div>
      )}
    </div>
  )
}

function CountryBadge({ code }: { code: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-2xs font-bold text-text-secondary">
      {code}
    </span>
  )
}
