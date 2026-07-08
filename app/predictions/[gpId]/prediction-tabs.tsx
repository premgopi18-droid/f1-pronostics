'use client'

import { useRef, useState } from 'react'
import { PredictionForm, type Driver } from './prediction-form'
import { buildTabLabel } from '@/lib/predictions/helpers'
import { Badge } from '@/app/ui/badge'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { SessionType } from '@/lib/scoring/types'

export { buildTabLabel }

const TAB_LABELS: Record<SessionType, string> = {
  qualifying:        t('predict.tab.qualifying'),
  race:              t('predict.tab.race'),
  sprint_qualifying: t('predict.tab.sprint_qualifying'),
  sprint_race:       t('predict.tab.sprint_race'),
}

export interface SessionData {
  id:                 string
  type:               SessionType
  startsAt:           string
  expectedCount:      number
  existingEntries:    string[]
  existingFastestLap: string | null
  isLocked:           boolean
}

interface Props {
  sessions: SessionData[]
  drivers:  Driver[]
}

export function PredictionTabs({ sessions, drivers }: Props) {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, sessions.findIndex((s) => !s.isLocked)),
  )

  const [savedEntries, setSavedEntries] = useState<Map<string, string[]>>(
    () => new Map(sessions.filter((s) => s.existingEntries.length > 0).map((s) => [s.id, s.existingEntries])),
  )

  const handleSaved = (sessionId: string, entries: string[]) => {
    setSavedEntries((prev) => new Map(prev).set(sessionId, entries))
  }

  // Roving tabindex : navigation clavier par flèches dans le tablist (pattern WAI-ARIA).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const focusTab = (index: number) => {
    setActiveIndex(index)
    tabRefs.current[index]?.focus()
  }

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const count = sessions.length
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (activeIndex + 1) % count
    else if (event.key === 'ArrowLeft') next = (activeIndex - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next !== null) {
      event.preventDefault()
      focusTab(next)
    }
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-text-secondary">{t('predict.noSessions')}</p>
  }

  const activeSession = sessions[activeIndex]
  const hasTabs       = sessions.length > 1
  const activeEntries = savedEntries.get(activeSession.id) ?? activeSession.existingEntries
  const isComplete    = activeEntries.length === activeSession.expectedCount

  const tabLabel = (session: SessionData, index: number) =>
    buildTabLabel(
      TAB_LABELS[session.type],
      (savedEntries.get(session.id) ?? session.existingEntries).length > 0,
      index === activeIndex,
    )

  return (
    <div className="flex flex-col gap-4">
      {/* Status line */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-text-secondary">
          {activeEntries.length}/{activeSession.expectedCount}
        </span>
        {activeSession.isLocked ? (
          <Badge variant="neutral">{t('predict.locked')}</Badge>
        ) : isComplete && savedEntries.has(activeSession.id) ? (
          <Badge variant="success">{t('predict.saved')}</Badge>
        ) : (
          <Badge variant="warning">{t('predict.open')}</Badge>
        )}
      </div>

      {/* Tab switcher */}
      {hasTabs && (
        <div
          role="tablist"
          aria-label={t('predict.sessionsLabel')}
          onKeyDown={onTabKeyDown}
          className="flex gap-1 rounded-xl border border-border bg-card p-1"
        >
          {sessions.map((session, i) => (
            <button type="button"
              key={session.id}
              ref={(el) => { tabRefs.current[i] = el }}
              id={`predict-tab-${session.id}`}
              role="tab"
              aria-selected={i === activeIndex}
              aria-controls="predict-tabpanel"
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                i === activeIndex
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-text-secondary hover:text-foreground',
              )}
            >
              {tabLabel(session, i)}
            </button>
          ))}
        </div>
      )}

      {/* Active form */}
      <div
        role={hasTabs ? 'tabpanel' : undefined}
        id={hasTabs ? 'predict-tabpanel' : undefined}
        aria-labelledby={hasTabs ? `predict-tab-${activeSession.id}` : undefined}
      >
        <PredictionForm
          key={activeSession.id}
          sessionId={activeSession.id}
          sessionType={activeSession.type}
          drivers={drivers}
          expectedCount={activeSession.expectedCount}
          existingEntries={savedEntries.get(activeSession.id) ?? activeSession.existingEntries}
          existingFastestLap={activeSession.existingFastestLap}
          isLocked={activeSession.isLocked}
          onSaved={(entries) => handleSaved(activeSession.id, entries)}
        />
      </div>
    </div>
  )
}
