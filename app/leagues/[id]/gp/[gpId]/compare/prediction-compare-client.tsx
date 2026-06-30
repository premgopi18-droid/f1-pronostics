'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import { classifyPositionDelta } from '@/lib/scoring/position-mark'
import type { SessionType } from '@/lib/scoring/types'

export type SessionInfo = {
  id:          string
  type:        SessionType
  isConfirmed: boolean
}

export type MemberData = {
  userId:      string
  pseudo:      string
  isMe:        boolean
  predictions: Record<string, string[]>  // sessionId → entries (driver codes)
}

type Props = {
  sessions:       SessionInfo[]
  members:        MemberData[]
  officialResults: Record<string, string[]>  // sessionId → ordered driver codes
  currentUserId:  string
}

// Réutilise les libellés courts déjà traduits dans `predict.tab.*` (i18n approche A).
const SESSION_TAB_LABEL_KEYS: Record<SessionType, TranslationKey> = {
  qualifying:        'predict.tab.qualifying',
  race:              'predict.tab.race',
  sprint_qualifying: 'predict.tab.sprint_qualifying',
  sprint_race:       'predict.tab.sprint_race',
}

function matchQuality(
  predicted:   string | undefined,
  official:    string[] | undefined,
  position:    number,
  sessionType: SessionType,
): 'exact' | 'partial' | 'miss' | 'unknown' {
  if (!official || official.length === 0 || !predicted) return 'unknown'
  const actualPos = official.indexOf(predicted) + 1
  if (actualPos === 0) return 'miss'
  // Règle exact/partial/miss partagée avec le détail des résultats GP.
  return classifyPositionDelta(Math.abs(position - actualPos), sessionType)
}

// Indicateurs de qualité : sémantique propre (exact/partial/miss), indépendante de
// l'écurie → tokens d'état (success/warning/destructive), jamais surchargés par le thème.
const QUALITY_CLASSES: Record<'exact' | 'partial' | 'miss' | 'unknown', string> = {
  exact:   'text-success',
  partial: 'text-warning',
  miss:    'text-text-muted',
  unknown: 'text-text-secondary',
}

const QUALITY_BAR_CLASSES: Record<'exact' | 'partial' | 'miss' | 'unknown', string> = {
  exact:   'bg-success',
  partial: 'bg-warning',
  miss:    'bg-destructive',
  unknown: 'bg-muted',
}

// ── Vue groupe ────────────────────────────────────────────────────────────────

function GroupView({
  session,
  members,
  official,
}: {
  session: SessionInfo
  members: MemberData[]
  official: string[]
}) {
  const count = POSITIONS_TO_SCORE[session.type]

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => {
        const position     = i + 1
        // Pas de résultat officiel tant que la session n'est pas confirmée
        // (évite d'exposer des résultats provisoires déjà présents en base).
        const officialCode = session.isConfirmed ? official[i] : undefined

        return (
          <div key={position} className="flex flex-col gap-2">
            {/* Position header */}
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-xs w-6 tabular-nums">P{position}</span>
              {officialCode ? (
                <span className="text-foreground font-mono text-sm font-medium">{officialCode}</span>
              ) : (
                <span className="text-text-muted text-xs">{t('compare.predictionNone')}</span>
              )}
              {officialCode && (
                <span className="text-text-muted text-xs">{t('compare.officiel')}</span>
              )}
            </div>

            {/* Chips par membre */}
            <div className="flex flex-wrap gap-2 pl-8">
              {members.map((member) => {
                const predicted = member.predictions[session.id]?.[i]
                const quality   = session.isConfirmed
                  ? matchQuality(predicted, official, position, session.type)
                  : 'unknown'

                return (
                  <div
                    key={member.userId}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs',
                      member.isMe ? 'bg-secondary' : 'bg-card',
                    )}
                  >
                    <span className="text-text-secondary">{member.pseudo}</span>
                    <span className={cn('font-mono font-medium', QUALITY_CLASSES[quality])}>
                      {predicted ?? t('compare.predictionNone')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vue tête-à-tête ───────────────────────────────────────────────────────────

function HeadToHeadView({
  session,
  me,
  opponent,
  official,
}: {
  session:  SessionInfo
  me:       MemberData
  opponent: MemberData
  official: string[]
}) {
  const count = POSITIONS_TO_SCORE[session.type]

  return (
    <div className="flex flex-col gap-1">
      {/* Header colonnes */}
      <div className="grid grid-cols-[1fr_2rem_1fr] gap-2 px-1 pb-1">
        <span className="text-xs text-text-secondary text-left">{t('compare.toi')}</span>
        <span />
        <span className="text-xs text-text-secondary text-right truncate">{opponent.pseudo}</span>
      </div>

      {Array.from({ length: count }, (_, i) => {
        const position      = i + 1
        const myPred        = me.predictions[session.id]?.[i]
        const theirPred     = opponent.predictions[session.id]?.[i]
        const myQuality     = session.isConfirmed
          ? matchQuality(myPred, official, position, session.type)
          : 'unknown'
        const theirQuality  = session.isConfirmed
          ? matchQuality(theirPred, official, position, session.type)
          : 'unknown'

        return (
          <div
            key={position}
            className="grid grid-cols-[1fr_2rem_1fr] items-center gap-2 py-1.5"
          >
            {/* Ma prédiction */}
            <div className="flex items-center gap-1.5 justify-start">
              <div
                className={cn('w-0.5 h-5 rounded-full shrink-0', QUALITY_BAR_CLASSES[myQuality])}
                aria-hidden
              />
              <span className={cn('font-mono text-sm font-medium tabular-nums', QUALITY_CLASSES[myQuality])}>
                {myPred ?? t('compare.predictionNone')}
              </span>
            </div>

            {/* Position */}
            <span className="text-text-muted text-xs tabular-nums text-center">
              P{position}
            </span>

            {/* Prédiction adversaire */}
            <div className="flex items-center gap-1.5 justify-end">
              <span className={cn('font-mono text-sm font-medium tabular-nums', QUALITY_CLASSES[theirQuality])}>
                {theirPred ?? t('compare.predictionNone')}
              </span>
              <div
                className={cn('w-0.5 h-5 rounded-full shrink-0', QUALITY_BAR_CLASSES[theirQuality])}
                aria-hidden
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export function PredictionCompareClient({
  sessions,
  members,
  officialResults,
  currentUserId,
}: Props) {
  const [activeSessionId, setActiveSessionId] = useState(
    sessions.find((s) => s.type === 'race')?.id ?? sessions[0]?.id ?? '',
  )
  const [view, setView]               = useState<'group' | 'head-to-head'>('group')
  const [opponentIndex, setOpponentIndex] = useState(0)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const official      = activeSession ? (officialResults[activeSession.id] ?? []) : []
  const me            = members.find((m) => m.userId === currentUserId)
  const opponents     = members.filter((m) => m.userId !== currentUserId)
  const opponent      = opponents[opponentIndex]

  if (!activeSession) return null

  return (
    <div className="flex flex-col gap-6">

      {/* Onglets sessions */}
      {sessions.length > 1 && (
        <div className="flex gap-1 border border-border bg-card p-1 rounded-xl" role="tablist">
          {sessions.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === activeSessionId}
              onClick={() => setActiveSessionId(s.id)}
              className={cn(
                'flex-1 text-xs py-1.5 px-2 rounded-lg transition-colors',
                s.id === activeSessionId
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-text-secondary hover:text-foreground',
              )}
            >
              {t(SESSION_TAB_LABEL_KEYS[s.type])}
            </button>
          ))}
        </div>
      )}

      {/* Toggle Vue groupe / Tête-à-tête */}
      <div className="flex gap-0 border border-border bg-card p-1 rounded-xl" role="tablist" aria-label={t('compare.modeLabel')}>
        <button
          role="tab"
          aria-selected={view === 'group'}
          onClick={() => setView('group')}
          className={cn(
            'flex-1 text-sm py-2 px-3 rounded-lg transition-colors',
            view === 'group'
              ? 'bg-primary text-primary-foreground font-medium shadow-sm'
              : 'text-text-secondary hover:text-foreground',
          )}
        >
          {t('compare.vueGroupe')}
        </button>
        <button
          role="tab"
          aria-selected={view === 'head-to-head'}
          onClick={() => setView('head-to-head')}
          className={cn(
            'flex-1 text-sm py-2 px-3 rounded-lg transition-colors',
            view === 'head-to-head'
              ? 'bg-primary text-primary-foreground font-medium shadow-sm'
              : 'text-text-secondary hover:text-foreground',
          )}
        >
          {t('compare.teteATete')}
        </button>
      </div>

      {/* Vue groupe */}
      {view === 'group' && (
        <GroupView
          session={activeSession}
          members={members}
          official={official}
        />
      )}

      {/* Tête-à-tête */}
      {view === 'head-to-head' && (
        <div className="flex flex-col gap-4">
          {opponents.length === 0 ? (
            <p className="text-text-secondary text-sm">{t('compare.noOtherMembers')}</p>
          ) : (
            <>
              {/* Sélecteur adversaire */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setOpponentIndex((prev) => (prev - 1 + opponents.length) % opponents.length)
                  }
                  className="p-2 text-text-secondary hover:text-foreground transition-colors disabled:opacity-30"
                  disabled={opponents.length <= 1}
                  aria-label={t('compare.prevOpponent')}
                >
                  ‹
                </button>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">{t('compare.toiVs')}</p>
                  <p className="text-foreground font-semibold">{opponent?.pseudo ?? '?'}</p>
                </div>
                <button
                  onClick={() =>
                    setOpponentIndex((prev) => (prev + 1) % opponents.length)
                  }
                  className="p-2 text-text-secondary hover:text-foreground transition-colors disabled:opacity-30"
                  disabled={opponents.length <= 1}
                  aria-label={t('compare.nextOpponent')}
                >
                  ›
                </button>
              </div>

              {me && opponent && (
                <HeadToHeadView
                  session={activeSession}
                  me={me}
                  opponent={opponent}
                  official={official}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
