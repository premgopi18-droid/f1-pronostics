'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { TEAM_COLORS, DEFAULT_TEAM_COLOR } from '@/lib/f1/team-colors'
import type { GpResultRow, PracticeResultRow } from '@/lib/data/results'

type Tab =
  | 'race'
  | 'qualifying'
  | 'sprintRace'
  | 'sprintQualifying'
  | 'practice1'
  | 'practice2'
  | 'practice3'

const OFFICIAL_TABS: { id: Tab; label: () => string }[] = [
  { id: 'race',       label: () => t('results.tabRace') },
  { id: 'qualifying', label: () => t('results.tabQualifying') },
]

// Onglets sprint : week-ends sprint uniquement, affichés si des données existent.
const SPRINT_TABS: { id: Tab; label: () => string }[] = [
  { id: 'sprintRace',       label: () => t('results.tabSprint') },
  { id: 'sprintQualifying', label: () => t('results.tabSprintQualifying') },
]

const PRACTICE_TABS: { id: Tab; label: () => string }[] = [
  { id: 'practice1', label: () => t('results.tabPractice1') },
  { id: 'practice2', label: () => t('results.tabPractice2') },
  { id: 'practice3', label: () => t('results.tabPractice3') },
]

interface Props {
  race: GpResultRow[]
  qualifying: GpResultRow[]
  sprintRace: GpResultRow[]
  sprintQualifying: GpResultRow[]
  practice1: PracticeResultRow[]
  practice2: PracticeResultRow[]
  practice3: PracticeResultRow[]
}

export function GpResultsTabs({
  race,
  qualifying,
  sprintRace,
  sprintQualifying,
  practice1,
  practice2,
  practice3,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('race')

  // Onglets sprint ajoutés aux officiels (mêmes résultats scorés) sur week-end sprint.
  const sprintTabs = SPRINT_TABS.filter(({ id }) =>
    id === 'sprintRace' ? sprintRace.length > 0 : sprintQualifying.length > 0,
  )
  const officialTabs = [...OFFICIAL_TABS, ...sprintTabs]

  const practiceTabs = PRACTICE_TABS.filter(({ id }) => {
    if (id === 'practice1') return practice1.length > 0
    if (id === 'practice2') return practice2.length > 0
    return practice3.length > 0
  })

  const getPracticeRows = (tab: Tab): PracticeResultRow[] => {
    if (tab === 'practice1') return practice1
    if (tab === 'practice2') return practice2
    if (tab === 'practice3') return practice3
    return []
  }

  const getOfficialRows = (tab: Tab): GpResultRow[] => {
    if (tab === 'race') return race
    if (tab === 'qualifying') return qualifying
    if (tab === 'sprintRace') return sprintRace
    if (tab === 'sprintQualifying') return sprintQualifying
    return []
  }

  const isPracticeTab = activeTab.startsWith('practice')
  const rows = isPracticeTab ? getPracticeRows(activeTab) : getOfficialRows(activeTab)
  const isEmpty = rows.length === 0

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Onglets officiels */}
      <div
        role="tablist"
        aria-label={t('results.gpResultsOfficial')}
        className="flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {officialTabs.map((tab) => (
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
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-secondary hover:text-foreground',
            )}
          >
            {tab.label()}
          </button>
        ))}
      </div>

      {/* Onglets essais libres (affichés uniquement si des données sont disponibles) */}
      {practiceTabs.length > 0 && (
        <div
          role="tablist"
          aria-label="Essais libres"
          className="flex gap-1 rounded-xl border border-border bg-card p-1"
        >
          {practiceTabs.map((tab) => (
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
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-text-secondary hover:text-foreground',
              )}
            >
              {tab.label()}
            </button>
          ))}
        </div>
      )}

      {/* Contenu */}
      <div
        role="tabpanel"
        id={`gp-results-tabpanel-${activeTab}`}
        aria-labelledby={`gp-results-tab-${activeTab}`}
      >
        {isEmpty ? (
          <p className="py-8 text-center text-sm text-text-secondary">
            {isPracticeTab ? t('results.practiceNoData') : t('results.noResults')}
          </p>
        ) : isPracticeTab ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {(rows as PracticeResultRow[]).map((row, i) => (
              <PracticeDriverRow
                key={row.driverCode}
                row={row}
                isLast={i === rows.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {(rows as GpResultRow[]).map((row, i) => (
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
  const teamColor = TEAM_COLORS[row.constructorCode] ?? DEFAULT_TEAM_COLOR
  const isDnf = row.dnf || (!row.dns && row.position === null)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        !isLast && 'border-b border-border',
      )}
    >
      <div className="w-6 shrink-0 text-right">
        {row.dns ? (
          <span className="text-xs font-bold text-text-muted">{t('results.dnsLabel')}</span>
        ) : isDnf ? (
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

      <div
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor }}
        aria-hidden
      />

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

      {isFirst && !isDnf && (
        <span className="text-2xs font-bold uppercase tracking-wider text-primary-text">
          {t('results.leader')}
        </span>
      )}
    </div>
  )
}

function PracticeDriverRow({
  row,
  isLast,
}: {
  row: PracticeResultRow
  isLast: boolean
}) {
  const teamColor = TEAM_COLORS[row.constructorCode] ?? DEFAULT_TEAM_COLOR

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        !isLast && 'border-b border-border',
      )}
    >
      <div className="w-6 shrink-0 text-right">
        <span className="text-sm tabular-nums text-text-secondary">{row.position}</span>
      </div>

      <div
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <span className="font-semibold text-foreground">{row.lastName}</span>
        <div className="text-xs text-text-muted">{row.constructorName}</div>
      </div>

      {row.bestLapTime != null && (
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
          {row.bestLapTime}
        </span>
      )}
    </div>
  )
}
