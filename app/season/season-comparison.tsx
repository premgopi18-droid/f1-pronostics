'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { TEAM_COLORS, DEFAULT_TEAM_COLOR } from '@/lib/f1/team-colors'
import { computeProjectedScore } from '@/lib/season/scoring'
import { WDC_COUNT, WCC_COUNT } from '@/lib/season/constants'
import { applySeasonItemAction } from '@/app/actions/season-predictions'
import type { DriverStanding, ConstructorStanding } from '@/lib/data/season'

// ── Types ──────────────────────────────────────────────────────────────────

interface SeasonItems {
  wdcMove: number
  wccMove: number
}

interface Props {
  userWdc:              string[] | null
  userWcc:              string[] | null
  driverStandings:      DriverStanding[]       // triés par position officielle
  constructorStandings: ConstructorStanding[]  // triés par position officielle
  seasonItems:          SeasonItems
  isItemsOpen:          boolean
}

type Tab = 'wdc' | 'wcc'

// ── Calculs locaux ─────────────────────────────────────────────────────────

function buildStandingsMap(standings: { code: string; position: number }[]): Map<string, number> {
  return new Map(standings.map((s) => [s.code, s.position]))
}

function buildPositionMap<T extends { position: number }>(standings: T[]): Map<number, T> {
  return new Map(standings.map((s) => [s.position, s]))
}

// ── Composant principal ────────────────────────────────────────────────────

export function SeasonComparison({
  userWdc,
  userWcc,
  driverStandings,
  constructorStandings,
  seasonItems,
  isItemsOpen,
}: Props) {
  const [tab, setTab] = useState<Tab>('wdc')

  const [wdcEntries, setWdcEntries] = useState<string[] | null>(userWdc)
  const [wccEntries, setWccEntries] = useState<string[] | null>(userWcc)
  const [wdcUsesLeft, setWdcUsesLeft] = useState(seasonItems.wdcMove)
  const [wccUsesLeft, setWccUsesLeft] = useState(seasonItems.wccMove)

  const wdcByCode = buildStandingsMap(driverStandings)
  const wccByCode = buildStandingsMap(constructorStandings)
  const wdcByPos  = buildPositionMap(driverStandings)
  const wccByPos  = buildPositionMap(constructorStandings)

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('season.tablistLabel')}
        className="mx-page mb-5 flex gap-1 rounded-xl border border-border bg-card p-1"
      >
        {(['wdc', 'wcc'] as Tab[]).map((t_) => (
          <button
            key={t_}
            role="tab"
            aria-selected={tab === t_}
            onClick={() => setTab(t_)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t_
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-secondary hover:text-foreground',
            )}
          >
            {t_ === 'wdc' ? t('season.tabWdc') : t('season.tabWcc')}
          </button>
        ))}
      </div>

      {tab === 'wdc' && (
        <ComparisonPanel
          type="wdc"
          title={t('season.wdcTitle')}
          entries={wdcEntries}
          predictionCount={WDC_COUNT}
          standingsByCode={wdcByCode}
          getEntryName={(code) => wdcByPos.get(wdcByCode.get(code) ?? 0)?.name ?? code}
          getOfficialName={(pos) => wdcByPos.get(pos)?.name ?? null}
          getTeamColor={(code) => {
            const s = driverStandings.find((d) => d.code === code)
            return TEAM_COLORS[s?.constructorCode ?? ''] ?? DEFAULT_TEAM_COLOR
          }}
          isItemsOpen={isItemsOpen}
          usesLeft={wdcUsesLeft}
          itemType="wdc_move"
          itemName={t('season.itemWdcName')}
          itemDesc={t('season.itemWdcDesc')}
          onEntriesChange={setWdcEntries}
          onUsesChange={setWdcUsesLeft}
        />
      )}

      {tab === 'wcc' && (
        <ComparisonPanel
          type="wcc"
          title={t('season.wccTitle')}
          entries={wccEntries}
          predictionCount={WCC_COUNT}
          standingsByCode={wccByCode}
          getEntryName={(code) => constructorStandings.find((c) => c.code === code)?.name ?? code}
          getOfficialName={(pos) => wccByPos.get(pos)?.name ?? null}
          getTeamColor={(code) => TEAM_COLORS[code] ?? DEFAULT_TEAM_COLOR}
          isItemsOpen={isItemsOpen}
          usesLeft={wccUsesLeft}
          itemType="wcc_move"
          itemName={t('season.itemWccName')}
          itemDesc={t('season.itemWccDesc')}
          onEntriesChange={setWccEntries}
          onUsesChange={setWccUsesLeft}
        />
      )}
    </div>
  )
}

// ── Panneau de comparaison (WDC ou WCC) ───────────────────────────────────

function ComparisonPanel({
  type,
  title,
  entries,
  predictionCount,
  standingsByCode,
  getEntryName,
  getOfficialName,
  getTeamColor,
  isItemsOpen,
  usesLeft,
  itemType,
  itemName,
  itemDesc,
  onEntriesChange,
  onUsesChange,
}: {
  type:                 'wdc' | 'wcc'
  title:                string
  entries:              string[] | null
  predictionCount:      number
  standingsByCode:      Map<string, number>
  getEntryName:         (code: string) => string
  getOfficialName:      (pos: number) => string | null
  getTeamColor:         (code: string) => string
  isItemsOpen:          boolean
  usesLeft:             number
  itemType:             'wdc_move' | 'wcc_move'
  itemName:             string
  itemDesc:             string
  onEntriesChange:      (entries: string[] | null) => void
  onUsesChange:         (n: number) => void
}) {
  const [itemFrom, setItemFrom]   = useState<number>(1)
  const [itemTo, setItemTo]       = useState<number>(2)
  const [showItem, setShowItem]   = useState(false)
  const [message, setMessage]     = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!entries) {
    return (
      <div className="px-page py-12 text-center">
        <p className="text-sm text-text-secondary">{t('season.noPrediction')}</p>
      </div>
    )
  }

  const standingsMap = standingsByCode

  // Stats
  const { score, bonus, exacts } = computeProjectedScore(entries, standingsMap)
  const showStats = type === 'wdc'

  const applyItem = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await applySeasonItemAction(itemType, itemFrom, itemTo)
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error })
      } else {
        const next = [...entries]
        const [extracted] = next.splice(itemFrom - 1, 1)
        next.splice(itemTo - 1, 0, extracted)
        onEntriesChange(next)
        onUsesChange(usesLeft - 1)
        setShowItem(false)
        setMessage({ type: 'ok', text: `${itemName} ${t('season.itemUsedSuffix')}` })
      }
    })
  }

  const canUseItem = isItemsOpen && usesLeft > 0

  return (
    <div className="flex flex-col gap-5 px-page">

      {/* Badge + titre */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-primary font-semibold">
          🔒 {t('season.lockedBadge')}
        </p>
      </div>

      {/* Stats (WDC uniquement) */}
      {showStats && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className="text-xl font-bold text-foreground tabular-nums">{exacts}</p>
            <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wider text-text-secondary">
              {t('season.statsExacts')}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className="text-xl font-bold text-primary tabular-nums">{score + bonus}</p>
            <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wider text-text-secondary">
              {t('season.statsProjected')}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* En-têtes */}
        <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] gap-0 border-b border-border px-3 py-2">
          <span />
          <span className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
            {t('season.colMyPrediction')}
          </span>
          <span className="text-2xs font-bold uppercase tracking-wider text-text-secondary">
            {t('season.colOfficial')}
          </span>
          <span className="text-right text-2xs font-bold uppercase tracking-wider text-text-secondary">
            {t('season.colGap')}
          </span>
        </div>

        {/* Lignes */}
        {entries.slice(0, predictionCount).map((code, i) => {
          const predicted = i + 1
          const official  = standingsMap.get(code) ?? null
          const delta     = official !== null ? Math.abs(predicted - official) : null
          const officialDriverName = getOfficialName(predicted)
          const myName    = getEntryName(code)
          const teamColor = getTeamColor(code)

          return (
            <ComparisonRow
              key={code}
              position={predicted}
              myName={myName}
              teamColor={teamColor}
              officialName={officialDriverName}
              delta={delta}
              isLast={i === predictionCount - 1}
            />
          )
        })}
      </div>

      {/* Message feedback item */}
      {message && (
        <p className={cn(
          'text-sm',
          message.type === 'ok' ? 'text-emerald-400' : 'text-destructive',
        )}>
          {message.text}
        </p>
      )}

      {/* Section item */}
      {canUseItem && (
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{itemName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{itemDesc}</p>
            </div>
            {!showItem && (
              <button
                onClick={() => setShowItem(true)}
                className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('season.use')}
              </button>
            )}
          </div>

          {showItem && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-xs text-text-secondary">{t('season.itemFromLabel')}</label>
                  <select
                    value={itemFrom}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setItemFrom(next)
                      if (itemTo === next) setItemTo(next === 1 ? 2 : 1)
                    }}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {entries.slice(0, predictionCount).map((code, i) => (
                      <option key={code} value={i + 1}>
                        P{i + 1} — {getEntryName(code)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-xs text-text-secondary">{t('season.itemToLabel')}</label>
                  <select
                    value={itemTo}
                    onChange={(e) => setItemTo(Number(e.target.value))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {entries
                      .slice(0, predictionCount)
                      .filter((_, i) => i + 1 !== itemFrom)
                      .map((code, i) => {
                        const pos = i >= itemFrom - 1 ? i + 2 : i + 1
                        return (
                          <option key={code} value={pos}>
                            P{pos} — {getEntryName(code)}
                          </option>
                        )
                      })}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyItem}
                  disabled={isPending || itemFrom === itemTo}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isPending ? t('season.sending') : t('season.confirm')}
                </button>
                <button
                  onClick={() => setShowItem(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {t('season.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ligne de comparaison ───────────────────────────────────────────────────

function ComparisonRow({
  position,
  myName,
  teamColor,
  officialName,
  delta,
  isLast,
}: {
  position:     number
  myName:       string
  teamColor:    string
  officialName: string | null
  delta:        number | null
  isLast:       boolean
}) {
  const status: 'exact' | 'close' | 'miss' | 'unknown' =
    delta === null ? 'unknown'
    : delta === 0  ? 'exact'
    : delta <= 2   ? 'close'
    : 'miss'

  const icon =
    status === 'exact'   ? '✓'
    : status === 'unknown' ? '✗'
    : '~'

  const iconClass =
    status === 'exact'   ? 'text-emerald-400'
    : status === 'unknown' ? 'text-text-muted'
    : 'text-amber-400'

  const gapText  = delta === null ? '—' : delta === 0 ? '0' : `±${delta}`
  const gapClass =
    status === 'exact'   ? 'text-emerald-400 font-bold'
    : status === 'unknown' ? 'text-text-muted'
    : status === 'close'   ? 'text-amber-400 font-bold'
    : 'text-destructive font-bold'

  return (
    <div
      className={cn(
        'grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-0 px-3 py-3',
        !isLast && 'border-b border-border',
      )}
    >
      {/* Position */}
      <span className="text-xs font-semibold tabular-nums text-text-secondary">P{position}</span>

      {/* Mon prono */}
      <div className="flex min-w-0 items-center gap-2 pr-2">
        <span
          className="h-4 w-0.5 shrink-0 rounded-full"
          style={{ backgroundColor: teamColor }}
          aria-hidden
        />
        <span className="truncate text-sm font-semibold text-foreground">{myName}</span>
        <span className={cn('shrink-0 text-xs font-bold', iconClass)} aria-hidden>
          {icon}
        </span>
      </div>

      {/* Officiel actuel */}
      <span className="truncate pr-2 text-sm text-text-secondary">
        {officialName ?? '—'}
      </span>

      {/* Écart */}
      <span className={cn('text-right text-sm tabular-nums', gapClass)}>
        {gapText}
      </span>
    </div>
  )
}
