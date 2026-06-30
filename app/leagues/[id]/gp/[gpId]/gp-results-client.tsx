'use client'

import { useMemo, useState } from 'react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AvatarHelmet } from '@/app/ui/avatar-helmet'
import type { SessionType } from '@/lib/scoring/types'
import type { DetailRow, FastestLapRow, ItemLine } from '@/lib/scoring/gp-detail'
import type { Fact } from '@/lib/items/facts'

// ── Types de vue (sérialisables, calculés côté serveur) ─────────────────────

export interface SessionView {
  type:  SessionType
  label: string
}

export interface MemberSessionDetail {
  finalScore:    number
  rows:          DetailRow[]
  fastestLap:    FastestLapRow | null
  items:         ItemLine[]
  hasPrediction: boolean
  invalid:       boolean
}

export interface MemberView {
  userId:      string
  pseudo:      string
  color:       string
  isMe:        boolean
  total:       number
  exactTotal:  number
  approxTotal: number
  sessions:    Partial<Record<SessionType, MemberSessionDetail>>
}

interface Props {
  members:  MemberView[]
  sessions: SessionView[]
  facts:    Fact[]
}

const RANK_COLOR = ['text-gold', 'text-silver', 'text-bronze'] as const
const DELTA_CLASS: Record<Fact['deltaKind'], string> = {
  pos: 'text-success',
  neg: 'text-destructive',
  nil: 'text-muted-foreground',
}

// ── Sous-composants ─────────────────────────────────────────────────────────

function MeTag() {
  return <span className="text-xs font-normal text-muted-foreground">{t('gpResults.me')}</span>
}

function Pills({ exact, approx }: { exact: number; approx: number }) {
  return (
    <span className="flex gap-1.5">
      {exact > 0 && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-success-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-success"
          aria-label={`${exact} ${t('gpResults.a11yExactCount')}`}
        >
          <span aria-hidden>●</span>{exact}
        </span>
      )}
      {approx > 0 && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-warning"
          aria-label={`${approx} ${t('gpResults.a11yApproxCount')}`}
        >
          <span aria-hidden>◐</span>{approx}
        </span>
      )}
    </span>
  )
}

function PositionMark({ row }: { row: DetailRow }) {
  if (row.mark === 'exact') {
    return <span className="font-bold text-success" aria-label={t('gpResults.a11yExact')}>●</span>
  }
  if (row.mark === 'partial') {
    return (
      <span
        className="font-bold text-warning"
        aria-label={`${t('gpResults.a11yGapPrefix')} ${row.delta} ${t('gpResults.a11yPositions')}`}
      >
        ±{row.delta}
      </span>
    )
  }
  return (
    <>
      <span className="font-bold text-muted-foreground" aria-label={t('gpResults.a11yMiss')}>✗</span>
      {row.actualCode && (
        <span className="font-mono text-muted-foreground">{row.actualCode}</span>
      )}
    </>
  )
}

function Gain({ pts }: { pts: number }) {
  return (
    <span className={cn('ml-auto font-semibold tabular-nums', pts > 0 ? 'text-foreground' : 'text-muted-foreground')}>
      {pts > 0 ? `+${pts}` : '—'}
    </span>
  )
}

function ItemLines({ items }: { items: ItemLine[] }) {
  return (
    <>
      {items.map((item, i) => (
        <div
          key={i}
          className="mt-0.5 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-1.5 text-xs"
        >
          <span className="text-sm">{item.emoji}</span>
          <span className="text-muted-foreground">{item.text}</span>
          <span className={cn('ml-auto font-bold tabular-nums', DELTA_CLASS[item.deltaKind])}>
            {item.deltaText}
          </span>
        </div>
      ))}
    </>
  )
}

function SessionDetailBody({ detail }: { detail: MemberSessionDetail | undefined }) {
  if (!detail) {
    return <p className="px-1 py-2 text-sm text-muted-foreground">{t('gpResults.emptyNoPredictionSession')}</p>
  }

  // Pas de prono : on affiche quand même l'impact des items joués/subis sur cette
  // session, sinon un Wild Card ou un bonus qui a bougé le score serait invisible.
  if (!detail.hasPrediction) {
    return (
      <div className="flex flex-col gap-0.5">
        <p className="px-1 py-2 text-sm text-muted-foreground">
          {detail.invalid ? t('gpResults.emptyInvalid') : t('gpResults.emptyNotSubmitted')}
        </p>
        <ItemLines items={detail.items} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {detail.rows.map((row) => (
        <div key={row.predictedPos} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
          <span className="w-5 text-right tabular-nums text-muted-foreground">P{row.predictedPos}</span>
          <span className={cn('w-9 font-mono', row.mark === 'exact' ? 'text-foreground' : 'text-text-secondary')}>
            {row.code}
          </span>
          <PositionMark row={row} />
          <Gain pts={row.pts} />
        </div>
      ))}

      {/* Meilleur tour — ligne séparée, bonus distinct (course uniquement) */}
      {detail.fastestLap && (
        <div className="mt-1 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs border-t border-border">
          <span className="pr-1 text-[11px] font-bold uppercase tracking-wide text-warning">
            {t('gpResults.meilleurTour')}
          </span>
          <span className={cn('w-9 font-mono', detail.fastestLap.isExact ? 'text-foreground' : 'text-text-secondary')}>
            {detail.fastestLap.code ?? '—'}
          </span>
          {!detail.fastestLap.played ? (
            <span className="text-muted-foreground" aria-label={t('gpResults.flNotPlayed')}>
              {t('gpResults.flNotPlayed')}
            </span>
          ) : detail.fastestLap.isExact ? (
            <span className="font-bold text-success" aria-label={t('gpResults.a11yExact')}>●</span>
          ) : (
            <>
              <span className="font-bold text-muted-foreground" aria-label={t('gpResults.a11yMiss')}>✗</span>
              {detail.fastestLap.actualCode && (
                <span className="font-mono text-muted-foreground">{detail.fastestLap.actualCode}</span>
              )}
            </>
          )}
          <Gain pts={detail.fastestLap.pts} />
        </div>
      )}

      {/* Impact des items */}
      <ItemLines items={detail.items} />
    </div>
  )
}

// ── Composant principal ─────────────────────────────────────────────────────

export function GPResultsClient({ members, sessions, facts }: Props) {
  const defaultMember = members.find((m) => m.isMe)?.userId ?? members[0]?.userId ?? ''
  const [selectedId, setSelectedId] = useState(defaultMember)

  const selected = members.find((m) => m.userId === selectedId) ?? members[0]

  // Session sélectionnée : course par défaut, sinon dernière session disponible.
  const availableForSelected = useMemo(
    () => sessions.filter((s) => selected?.sessions[s.type] != null),
    [sessions, selected],
  )
  const defaultSession =
    availableForSelected.find((s) => s.type === 'race')?.type ??
    availableForSelected[availableForSelected.length - 1]?.type ??
    sessions[0]?.type
  const [sessionPick, setSessionPick] = useState<SessionType | undefined>(defaultSession)

  // La session retenue doit exister pour le membre sélectionné, sinon repli.
  const activeSession: SessionType | undefined =
    (sessionPick && selected?.sessions[sessionPick] != null)
      ? sessionPick
      : defaultSession

  const activeDetail = activeSession ? selected?.sessions[activeSession] : undefined
  const activeLabel  = sessions.find((s) => s.type === activeSession)?.label ?? ''

  return (
    <>
      {/* Classement */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t('gpResults.totalGp')}
        </h2>
        <div className="flex flex-col gap-1">
          {members.map((m, i) => (
            <button
              key={m.userId}
              type="button"
              onClick={() => setSelectedId(m.userId)}
              aria-pressed={m.userId === selectedId}
              className={cn(
                'flex items-center gap-3 rounded-xl border-l-[3px] border-transparent bg-surface-2 px-4 py-2.5 text-left transition-colors hover:brightness-110',
                m.isMe && 'border-accent bg-accent-soft',
                m.userId === selectedId && 'ring-[1.5px] ring-accent ring-inset',
              )}
            >
              <span className={cn('w-5 text-right text-sm font-bold tabular-nums', RANK_COLOR[i] ?? 'text-muted-foreground')}>
                {i + 1}
              </span>
              <AvatarHelmet color={m.color} size={22} label={m.pseudo} />
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5 font-semibold text-foreground">
                <span className="truncate">{m.pseudo}</span>
                {m.isMe && <MeTag />}
              </span>
              <Pills exact={m.exactTotal} approx={m.approxTotal} />
              <span className="font-bold tabular-nums text-foreground">{m.total} {t('gpResults.pts')}</span>
              <span className={cn('text-sm', m.userId === selectedId ? 'text-accent' : 'text-muted-foreground')}>▸</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-success">●</span>{t('gpResults.legendExact')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-warning">◐</span>{t('gpResults.legendApprox')}</span>
          <span>{t('gpResults.legendGapHint')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />{t('gpResults.legendMe')}</span>
        </div>
      </section>

      {/* Faits marquants — visible seulement après résolution des items */}
      {facts.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t('gpResults.factsTitle')}
          </h2>
          {facts.map((fact) => (
            <div key={fact.key} className="flex flex-col gap-2 rounded-xl bg-card px-3.5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{fact.emoji}</span>
                <span className="flex flex-wrap items-center gap-x-1.5">
                  <span className="font-semibold" style={{ color: fact.actorColor }}>{fact.actorPseudo}</span>
                  <span className="text-muted-foreground">{fact.verb}</span>
                  <span className="font-semibold text-foreground">{fact.object}</span>
                  {fact.targetPseudo && (
                    <>
                      <span className="text-muted-foreground">{fact.prep}</span>
                      <span className="font-semibold" style={{ color: fact.targetColor }}>{fact.targetPseudo}</span>
                    </>
                  )}
                  {fact.sessionLabel && <span className="text-muted-foreground">· {fact.sessionLabel}</span>}
                </span>
                <span className="ml-auto">
                  {fact.tag ? (
                    <span className="rounded-md bg-destructive-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                      {fact.tag}
                    </span>
                  ) : fact.deltaText ? (
                    <span className={cn('font-bold tabular-nums', DELTA_CLASS[fact.deltaKind])}>{fact.deltaText}</span>
                  ) : null}
                </span>
              </div>
              <div className="ml-2 flex flex-col gap-1 border-l-2 border-border pl-3">
                {fact.chain.map((step, i) => (
                  <p key={i} className="text-[13px] text-muted-foreground">{step}</p>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Détail du joueur */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t('gpResults.detailTitle')}
        </h2>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{t('gpResults.detailHint')}</p>

        {selected && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-3.5">
            <div className="flex items-center gap-2.5">
              <AvatarHelmet color={selected.color} size={28} label={selected.pseudo} />
              <span className="flex items-baseline gap-1.5 text-base font-bold text-foreground">
                {selected.pseudo}
                {selected.isMe && <MeTag />}
              </span>
              <span className="ml-auto text-right">
                <span className="block text-base font-bold text-foreground">{selected.total} {t('gpResults.pts')}</span>
                <span className="block text-[11px] text-muted-foreground">{t('gpResults.totalGpSub')}</span>
              </span>
            </div>

            {sessions.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="tablist">
                {sessions.map((s) => {
                  const has = selected.sessions[s.type] != null
                  const on  = s.type === activeSession
                  return (
                    <button
                      key={s.type}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      disabled={!has}
                      onClick={() => setSessionPick(s.type)}
                      className={cn(
                        'rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold transition-colors',
                        on
                          ? 'border-accent/40 bg-accent-soft text-accent'
                          : 'bg-surface-2 text-muted-foreground hover:brightness-110',
                        !has && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            )}

            {activeDetail && (
              <p className="-mb-0.5 mt-0.5 text-[11px] text-muted-foreground">
                {activeLabel} — {activeDetail.finalScore} {t('gpResults.pts')}
              </p>
            )}

            <SessionDetailBody detail={activeDetail} />
          </div>
        )}
      </section>
    </>
  )
}
