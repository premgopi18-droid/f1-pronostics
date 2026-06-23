'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { TEAM_COLORS } from '@/lib/f1/team-colors'
import type { GpResultRow } from '@/lib/data/results'

type Tab = 'race' | 'qualifying'

const TABS: { id: Tab; label: () => string }[] = [
  { id: 'race',       label: () => t('results.tabRace') },
  { id: 'qualifying', label: () => t('results.tabQualifying') },
]

interface Props {
  race: GpResultRow[]
  qualifying: GpResultRow[]
}

export function GpResultsTabs({ race, qualifying }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('race')
  const rows = activeTab === 'race' ? race : qualifying
  const isEmpty = rows.length === 0

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('results.gpResultsOfficial')}
        className="flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`gp-results-tabpanel-${tab.id}`}
            id={`gp-results-tab-${tab.id}`}
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

      {/* Results list */}
      <div
        role="tabpanel"
        id={`gp-results-tabpanel-${activeTab}`}
        aria-labelledby={`gp-results-tab-${activeTab}`}
      >
        {isEmpty ? (
          <p className="py-8 text-center text-sm text-text-secondary">
            {t('results.noResults')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {rows.map((row, i) => (
              <DriverRow
                key={row.driverCode}
                row={row}
                isFirst={i === 0}
                isLast={i === rows.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DriverRow({
  row,
  isFirst,
  isLast,
}: {
  row: GpResultRow
  isFirst: boolean
  isLast: boolean
}) {
  const teamColor = TEAM_COLORS[row.constructorCode] ?? '#666666'
  const isDnf = row.dnf || row.position === null

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        !isLast && 'border-b border-border',
      )}
    >
      {/* Position */}
      <div className="w-6 shrink-0 text-right">
        {isDnf ? (
          <span className="text-xs font-bold text-destructive">{t('results.dnfLabel')}</span>
        ) : (
          <span
            className={cn(
              'text-sm tabular-nums',
              isFirst ? 'font-bold text-foreground' : 'text-text-secondary',
            )}
          >
            {row.position}
          </span>
        )}
      </div>

      {/* Team color indicator */}
      <div
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor }}
        aria-hidden
      />

      {/* Driver info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-semibold',
              isDnf ? 'text-text-secondary' : 'text-foreground',
            )}
          >
            {row.lastName}
          </span>
          {row.fastestLap && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400"
              aria-label={t('results.fastestLap')}
              title={t('results.fastestLap')}
            />
          )}
        </div>
        <div className="text-xs text-text-muted">{row.constructorName}</div>
      </div>

      {/* Leader badge */}
      {isFirst && !isDnf && (
        <span className="text-2xs font-bold uppercase tracking-wider text-primary">
          {t('results.leader')}
        </span>
      )}
    </div>
  )
}
