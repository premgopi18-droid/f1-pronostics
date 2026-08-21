'use client'

import { useState, useTransition, useEffect } from 'react'
import { translateActionError } from '@/lib/actions/errors'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { submitPredictionAction, submitFastestLapAction } from '@/app/actions/predictions'
import { TEAM_COLORS } from '@/lib/f1/team-colors'
import { usePrefersReducedMotion, setReduceMotionOverride } from '@/lib/hooks/use-prefers-reduced-motion'
import { useTapSelect } from '@/lib/hooks/use-tap-select'
import {
  buildPrefilledRaceOrder,
  buildPrefilledTopEntries,
  isGridPrefilled,
  type GridSource,
} from '@/lib/predictions/helpers'
import { t } from '@/lib/i18n'
import { Badge } from '@/app/ui/badge'
import { Button } from '@/app/ui/button'
import { BottomSheet } from '@/app/ui/bottom-sheet'
import { cn } from '@/lib/utils'
import type { SessionType } from '@/lib/scoring/types'

const A11Y_HINT_KEY = 'a11y-hint-dismissed'

export interface Driver {
  id:        string
  code:      string
  firstName: string
  lastName:  string
  // Nullable comme en DB (drivers.number) — jamais rendu dans le formulaire.
  number:    number | null
  teamCode:  string
  teamName:  string
  /** #211 : jamais vu sur une session fiable du week-end alors que d'autres
   *  l'ont été — badge « Absent du week-end ? », sélection jamais bloquée. */
  absentFromWeekend: boolean
}

interface Props {
  sessionId:          string
  sessionType:        SessionType
  drivers:            Driver[]
  expectedCount:      number
  existingEntries:    string[]
  existingFastestLap: string | null
  isLocked:           boolean
  /** Ordre de grille proposé (codes pilotes) — vide si aucune grille connue. */
  gridOrder:          string[]
  gridSource:         GridSource | null
  onSaved?:           (entries: string[]) => void
}

const DRAG_ACTIVATION_DISTANCE = 6 // px — évite les drags accidentels sur tap mobile

const POSITION_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }


function positionStyle(pos: number) {
  const color = POSITION_COLORS[pos]
  return color ? { color } : undefined
}

// ─── Sortable row wrapper ──────────────────────────────────────────────────

interface SortableRowProps {
  id:            string
  reducedMotion: boolean
  children:      (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>, isDragging: boolean) => React.ReactNode
}

function SortableRow({ id, reducedMotion, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition: reducedMotion ? undefined : transition,
      }}
    >
      {children({ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>, isDragging)}
    </div>
  )
}

// ─── A11y hint banner ──────────────────────────────────────────────────────

/** Banner d'onboarding a11y : visible au premier lancement tant que le mode n'est
 *  pas actif et que l'utilisateur ne l'a pas déjà fermé (flag `localStorage`).
 *  Partagé tel quel par `RaceForm` et `QualifsForm`. */
function useA11yHint(reducedMotion: boolean) {
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    // Wrapper volontaire : `react-hooks/set-state-in-effect` interdit un setState
    // synchrone direct dans le corps de l'effet, mais l'accepte via un appel de fonction.
    const syncHint = () => { if (!reducedMotion && !localStorage.getItem(A11Y_HINT_KEY)) setShowHint(true) }
    syncHint()
  }, [reducedMotion])

  const dismissHint = () => { localStorage.setItem(A11Y_HINT_KEY, '1'); setShowHint(false) }
  const activateA11y = () => { setReduceMotionOverride(true); setShowHint(false) }

  return { showHint, dismissHint, activateA11y }
}

function A11yHintBanner({ onActivate, onDismiss }: { onActivate: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
      <p className="text-sm text-text-secondary">
        {t('predict.a11yHint')}{' '}
        <button type="button" onClick={onActivate} className="text-primary-text underline underline-offset-2 transition-opacity hover:opacity-80">
          {t('predict.a11yHintCta')}
        </button>
      </p>
      <button type="button"
        onClick={onDismiss}
        aria-label={t('predict.close')}
        className="shrink-0 text-lg leading-none text-text-secondary transition-colors hover:text-foreground"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

// ─── Grid prefill (bandeau + bouton « repartir de la grille ») ─────────────

/** Bandeau signalant que l'ordre proposé vient de la grille (pas un prono déjà
 *  fait) + bouton de réinitialisation sur la grille, visible dès qu'une grille
 *  est connue — y compris quand un prono existe déjà. Libellés adaptés à la
 *  source : grille officielle vs classement des qualifications (fallback).
 *  Partagé par `RaceForm` et `QualifsForm`. */
function GridPrefillControls({ gridSource, wasPrefilled, disabled, onReset }: {
  gridSource:   GridSource
  wasPrefilled: boolean
  /** Désactivé pendant l'enregistrement : un reset en plein save brouillerait
   *  l'état local et le message de confirmation. */
  disabled:     boolean
  onReset:      () => void
}) {
  const isOfficialGrid = gridSource === 'grid'
  return (
    <div className="flex flex-col gap-2">
      {wasPrefilled && (
        <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm text-text-secondary">
          {isOfficialGrid ? t('predict.gridPrefilled') : t('predict.gridPrefilledQualifying')}
        </p>
      )}
      <button type="button"
        onClick={onReset}
        disabled={disabled}
        className="flex items-center gap-1.5 self-start text-sm font-semibold text-primary-text transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-30"
      >
        <RotateCcw size={14} aria-hidden="true" />
        {isOfficialGrid ? t('predict.gridReset') : t('predict.gridResetQualifying')}
      </button>
    </div>
  )
}

// ─── Driver row (shared visual, different variants) ────────────────────────

function DriverInfo({ driver, position, large }: { driver: Driver; position?: number; large?: boolean }) {
  const teamColor = TEAM_COLORS[driver.teamCode] ?? '#888'
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn('truncate font-semibold text-foreground', large ? 'text-base' : 'text-sm')}
          style={position ? positionStyle(position) : undefined}
        >
          {driver.firstName} {driver.lastName}
        </span>
        {driver.absentFromWeekend && (
          <Badge variant="warning" className="shrink-0">{t('predict.absentFromWeekend')}</Badge>
        )}
      </span>
      <span className="text-2xs font-medium" style={{ color: teamColor }}>
        {driver.teamName}
      </span>
    </div>
  )
}

// ─── Avertissement « absent classé » (partagé course / qualifs / sprint) ───

/** Noms complets des pilotes classés alors qu'ils sont badgés absents du week-end. */
function rankedAbsentNames(selected: string[], driverByCode: Map<string, Driver>): string[] {
  return selected
    .map((code) => driverByCode.get(code))
    .filter((driver): driver is Driver => Boolean(driver?.absentFromWeekend))
    .map((driver) => `${driver.firstName} ${driver.lastName}`)
}

/** Nudge non bloquant : classer un absent reste permis (le signal est une
 *  déduction), mais la conséquence — 0 point s'il ne court pas — est rappelée. */
function AbsentRankedWarning({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return (
    <p role="status" className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
      {t('predict.rankedAbsentWarning', { names: names.join(', ') })}
    </p>
  )
}

// ─── Locked state ──────────────────────────────────────────────────────────

function LockedView({ selected, driverByCode }: {
  selected:    string[]
  driverByCode: Map<string, Driver>
}) {
  if (selected.length === 0) {
    return <p className="text-sm text-text-secondary">{t('predict.noPrediction')}</p>
  }
  return (
    <ol className="flex flex-col gap-1">
      {selected.map((code, i) => {
        const driver = driverByCode.get(code)
        if (!driver) return null
        return (
          <li key={code} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
            <span className="w-5 shrink-0 text-right text-sm tabular-nums text-text-secondary" style={positionStyle(i + 1)}>
              {i + 1}
            </span>
            <DriverInfo driver={driver} position={i + 1} />
          </li>
        )
      })}
    </ol>
  )
}

// ─── Race form (full 22-driver reorder) ────────────────────────────────────

function RaceForm({
  sessionId,
  drivers,
  expectedCount,
  existingEntries,
  existingFastestLap,
  gridOrder,
  gridSource,
  onSaved,
}: {
  sessionId:          string
  drivers:            Driver[]
  expectedCount:      number
  existingEntries:    string[]
  existingFastestLap: string | null
  gridOrder:          string[]
  gridSource:         GridSource | null
  onSaved?:           (entries: string[]) => void
}) {
  const allCodes = drivers.map((d) => d.code)

  const [selected,            setSelected]            = useState<string[]>(() => buildPrefilledRaceOrder(existingEntries, gridOrder, allCodes, expectedCount))
  const [fastestLap,          setFastestLap]          = useState(existingFastestLap ?? '')
  const [fastestLapSheetOpen, setFastestLapSheetOpen] = useState(false)
  const [message,             setMessage]             = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending,  startTransition] = useTransition()
  const reducedMotion = usePrefersReducedMotion()
  const { showHint, dismissHint, activateA11y } = useA11yHint(reducedMotion)

  const moveDriverUp = (index: number) => {
    if (index === 0) return
    setSelected((prev) => arrayMove(prev, index, index - 1))
    setMessage(null)
  }

  const moveDriverDown = (index: number) => {
    if (index === selected.length - 1) return
    setSelected((prev) => arrayMove(prev, index, index + 1))
    setMessage(null)
  }

  const driverByCode = new Map(drivers.map((d) => [d.code, d]))

  // Liste saison > partants (échange de baquet) : la course se classe à
  // exactement `expectedCount`, le surplus vit dans une section « non classés ».
  const unranked      = drivers.filter((d) => !selected.includes(d.code))
  const hasSpares     = drivers.length > expectedCount
  const isComplete    = selected.length === expectedCount
  const absentsRanked = rankedAbsentNames(selected, driverByCode)

  const { selectedCode, onRowTap, onDragStart } = useTapSelect(
    selected,
    (newItems) => { setSelected(newItems); setMessage(null) },
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setSelected((prev) => {
      const from = prev.indexOf(active.id as string)
      const to   = prev.indexOf(over.id as string)
      return arrayMove(prev, from, to)
    })
    setMessage(null)
  }

  const add = (code: string) => {
    if (isComplete || selected.includes(code)) return
    setSelected((prev) => [...prev, code])
    setMessage(null)
  }

  const remove = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index))
    setMessage(null)
  }

  // Réinitialise l'ordre LOCAL sur la grille — rien n'est enregistré tant que
  // l'utilisateur ne valide pas. Le message role="status" annonce l'action aux
  // lecteurs d'écran.
  const resetToGrid = () => {
    setSelected(buildPrefilledRaceOrder([], gridOrder, allCodes, expectedCount))
    setMessage({
      type: 'ok',
      text: gridSource === 'grid' ? t('predict.gridResetDone') : t('predict.gridResetDoneQualifying'),
    })
  }

  const save = () => {
    startTransition(async () => {
      const result = await submitPredictionAction(sessionId, selected)
      if ('error' in result) {
        setMessage({ type: 'error', text: translateActionError(result.error, result.errorVars) })
        return
      }
      if (fastestLap) {
        const flDriver = drivers.find((d) => d.code === fastestLap)
        if (flDriver) {
          const flResult = await submitFastestLapAction(sessionId, flDriver.id)
          if ('error' in flResult) {
            setMessage({ type: 'error', text: translateActionError(flResult.error, flResult.errorVars) })
            return
          }
        }
      }
      // Prono partiel (liste saison < 22) : enregistré mais is_valid=false côté
      // serveur → 0 point tant qu'il n'est pas complété. Le dire honnêtement.
      setMessage({
        type: 'ok',
        text: isComplete
          ? t('predict.savedOk')
          : t('predict.savedDraft', { count: selected.length, total: expectedCount }),
      })
      onSaved?.(selected)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subtitle (+ compteur quand la liste dépasse le nombre de partants) */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {hasSpares
            ? t(reducedMotion ? 'predict.courseSubtitleCappedA11y' : 'predict.courseSubtitleCapped', { count: expectedCount })
            : reducedMotion ? t('predict.courseSubtitleA11y') : t('predict.courseSubtitle')}
        </p>
        {hasSpares && (
          <span className={cn('text-xs font-semibold tabular-nums', isComplete ? 'text-success' : 'text-text-secondary')}>
            {selected.length}/{expectedCount}
          </span>
        )}
      </div>

      {/* A11y hint — premier lancement, mode drag actif */}
      {showHint && <A11yHintBanner onActivate={activateA11y} onDismiss={dismissHint} />}

      {/* Pré-remplissage grille : bandeau (si aucun prono enregistré) + reset */}
      {gridSource && (
        <GridPrefillControls
          gridSource={gridSource}
          wasPrefilled={isGridPrefilled(existingEntries, gridOrder)}
          disabled={isPending}
          onReset={resetToGrid}
        />
      )}

      {/* Sortable driver list */}
      <div className="flex flex-col gap-1">
        {hasSpares && (
          <p className="px-1 text-2xs font-semibold tracking-widest text-text-secondary">
            {t('predict.ranked')}
          </p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1">
              {selected.map((code, i) => {
                const driver = driverByCode.get(code)
                if (!driver) return null
                const isSelected = selectedCode === code
                return (
                  <SortableRow key={code} id={code} reducedMotion={reducedMotion}>
                    {(dragHandleProps, isDragging) => (
                      /* Tap = raccourci pointeur uniquement : l'équivalent clavier existe
                         (poignée dnd-kit + boutons Monter/Descendre focusables dans la ligne).
                         Rendre le <li> focusable dupliquerait chaque ligne dans l'ordre de tab. */
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                      <li
                        onClick={() => onRowTap(code)}
                        className={cn(
                          'flex cursor-pointer select-none items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-shadow',
                          isDragging && 'shadow-lg opacity-80',
                          isSelected && 'ring-2 ring-primary bg-primary/5',
                        )}
                      >
                        <span
                          className={cn('w-5 shrink-0 text-right tabular-nums text-text-secondary', reducedMotion ? 'text-base' : 'text-sm')}
                          style={positionStyle(i + 1)}
                        >
                          {i + 1}
                        </span>
                        <DriverInfo driver={driver} position={i + 1} large={reducedMotion} />
                        {reducedMotion && (
                          <>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); moveDriverUp(i) }}
                              aria-label={`${t('predict.moveUp')} ${driver.firstName} ${driver.lastName}`}
                              disabled={i === 0}
                              className="shrink-0 p-1 text-text-secondary transition-colors hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronUp size={16} aria-hidden="true" />
                            </button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); moveDriverDown(i) }}
                              aria-label={`${t('predict.moveDown')} ${driver.firstName} ${driver.lastName}`}
                              disabled={i === selected.length - 1}
                              className="shrink-0 p-1 text-text-secondary transition-colors hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronDown size={16} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button type="button"
                          {...dragHandleProps}
                          aria-label={t('predict.reorder')}
                          className="shrink-0 touch-none cursor-grab p-1 text-text-secondary active:cursor-grabbing hover:text-foreground"
                        >
                          <GripVertical size={16} aria-hidden="true" />
                        </button>
                        {hasSpares && (
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); remove(i) }}
                            aria-label={`${t('predict.remove')} ${driver.firstName} ${driver.lastName}`}
                            className="shrink-0 p-1 text-text-secondary transition-colors hover:text-destructive"
                          >
                            <span aria-hidden="true" className="text-base leading-none">×</span>
                          </button>
                        )}
                      </li>
                    )}
                  </SortableRow>
                )
              })}
            </ol>
          </SortableContext>
        </DndContext>
      </div>

      {/* Non classés — surplus de la liste saison (absents en tête de file) */}
      {unranked.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="px-1 text-2xs font-semibold tracking-widest text-text-secondary">
            {t('predict.unranked')}
          </p>
          {unranked.some((d) => d.absentFromWeekend) && (
            <p className="px-1 text-xs text-text-muted">{t('predict.absentHint')}</p>
          )}
          <ul className="flex flex-col gap-1">
            {unranked.map((driver) => (
              <li key={driver.code} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-text-secondary"
                >
                  +
                </span>
                <DriverInfo driver={driver} />
                <button type="button"
                  onClick={() => add(driver.code)}
                  disabled={isComplete}
                  aria-label={`${t('predict.add')} ${driver.firstName} ${driver.lastName}`}
                  className="shrink-0 text-sm font-semibold text-primary-text transition-colors hover:text-primary-text/80 disabled:pointer-events-none disabled:opacity-30"
                >
                  {t('predict.add')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nudge : un absent est classé — permis, mais conséquence rappelée */}
      <AbsentRankedWarning names={absentsRanked} />

      {/* Meilleur tour */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t('predict.fastestLap')} 🏎</p>
          <span className="text-xs text-text-secondary">{t('predict.fastestLapMeta')}</span>
        </div>
        <button
          type="button"
          onClick={() => setFastestLapSheetOpen(true)}
          aria-label={t('predict.fastestLap')}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40"
        >
          {fastestLap ? (
            <span className="font-mono font-semibold text-primary-text">{fastestLap}</span>
          ) : (
            <span className="text-text-secondary">{t('predict.choosePilot')} →</span>
          )}
          <span className="text-text-secondary">›</span>
        </button>
        <BottomSheet
          open={fastestLapSheetOpen}
          onClose={() => setFastestLapSheetOpen(false)}
          title={t('predict.fastestLap')}
        >
          <div className="flex flex-col gap-1 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
            {fastestLap && (
              <button
                type="button"
                onClick={() => { setFastestLap(''); setFastestLapSheetOpen(false) }}
                className="rounded-xl px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-secondary/40"
              >
                {t('predict.none')}
              </button>
            )}
            {drivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { setFastestLap(d.code); setFastestLapSheetOpen(false) }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors',
                  fastestLap === d.code
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-secondary/40',
                )}
              >
                <span className="w-8 shrink-0 font-mono font-semibold">{d.code}</span>
                <span className="truncate">{d.firstName} {d.lastName}</span>
                {d.absentFromWeekend && (
                  <Badge variant="warning" className="ml-auto shrink-0">{t('predict.absentFromWeekend')}</Badge>
                )}
              </button>
            ))}
          </div>
        </BottomSheet>
      </div>

      {/* Feedback */}
      {message && (
        <p role="status" className={cn('text-sm', message.type === 'ok' ? 'text-success' : 'text-destructive')}>
          {message.text}
        </p>
      )}

      <Button
        size="block"
        onClick={save}
        // Le 22/22 strict ne s'impose qu'en surplus de pilotes : à liste courte
        // (< 22, données incomplètes), l'enregistrement partiel reste possible
        // comme avant (le serveur accepte ≤ 22, is_valid seulement à 22).
        disabled={isPending || (hasSpares && !isComplete)}
        aria-busy={isPending}
      >
        {isPending
          ? t('predict.saving')
          : isComplete
          ? t('predict.save')
          : `${t('predict.save')} (${selected.length}/${expectedCount})`}
      </Button>
    </div>
  )
}

// ─── Qualifying form (classés / non classés) ──────────────────────────────

function QualifsForm({
  sessionId,
  drivers,
  expectedCount,
  existingEntries,
  gridOrder,
  gridSource,
  onSaved,
}: {
  sessionId:       string
  drivers:         Driver[]
  expectedCount:   number
  existingEntries: string[]
  gridOrder:       string[]
  gridSource:      GridSource | null
  onSaved?:        (entries: string[]) => void
}) {
  const allCodes = drivers.map((d) => d.code)

  const [selected,  setSelected]   = useState<string[]>(() => buildPrefilledTopEntries(existingEntries, gridOrder, allCodes, expectedCount))
  const [message,   setMessage]    = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const reducedMotion = usePrefersReducedMotion()
  const { showHint, dismissHint, activateA11y } = useA11yHint(reducedMotion)

  const moveDriverUp = (index: number) => {
    if (index === 0) return
    setSelected((prev) => arrayMove(prev, index, index - 1))
    setMessage(null)
  }

  const moveDriverDown = (index: number) => {
    if (index === selected.length - 1) return
    setSelected((prev) => arrayMove(prev, index, index + 1))
    setMessage(null)
  }

  const driverByCode = new Map(drivers.map((d) => [d.code, d]))
  const unranked     = drivers.filter((d) => !selected.includes(d.code))
  const isComplete   = selected.length === expectedCount

  const { selectedCode, onRowTap, onDragStart } = useTapSelect(
    selected,
    (newItems) => { setSelected(newItems); setMessage(null) },
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setSelected((prev) => {
      const from = prev.indexOf(active.id as string)
      const to   = prev.indexOf(over.id as string)
      return arrayMove(prev, from, to)
    })
    setMessage(null)
  }

  const add = (code: string) => {
    if (selected.length >= expectedCount || selected.includes(code)) return
    setSelected((prev) => [...prev, code])
    setMessage(null)
  }

  const remove = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index))
    setMessage(null)
  }

  // Réinitialise la sélection LOCALE sur le top N de la grille — rien n'est
  // enregistré tant que l'utilisateur ne valide pas.
  const resetToGrid = () => {
    setSelected(buildPrefilledTopEntries([], gridOrder, allCodes, expectedCount))
    setMessage({
      type: 'ok',
      text: gridSource === 'grid' ? t('predict.gridResetDone') : t('predict.gridResetDoneQualifying'),
    })
  }

  const save = () => {
    startTransition(async () => {
      const result = await submitPredictionAction(sessionId, selected)
      if ('error' in result) {
        setMessage({ type: 'error', text: translateActionError(result.error, result.errorVars) })
        return
      }
      // Prono partiel : enregistré mais is_valid=false côté serveur → 0 point
      // tant qu'il n'est pas complété. Le dire honnêtement (audit 21/08/2026).
      setMessage({
        type: 'ok',
        text: isComplete
          ? t('predict.savedOk')
          : t('predict.savedDraft', { count: selected.length, total: expectedCount }),
      })
      onSaved?.(selected)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subtitle + counter */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {t('predict.qualifsSubtitlePre')} {expectedCount}{' '}
          {reducedMotion ? t('predict.qualifsSubtitleA11yPost') : t('predict.qualifsSubtitlePost')}
        </p>
        <span className={cn('text-xs font-semibold tabular-nums', isComplete ? 'text-success' : 'text-text-secondary')}>
          {selected.length}/{expectedCount}
        </span>
      </div>

      {/* A11y hint — premier lancement, mode drag actif */}
      {showHint && <A11yHintBanner onActivate={activateA11y} onDismiss={dismissHint} />}

      {/* Pré-remplissage grille : bandeau (si aucun prono enregistré) + reset */}
      {gridSource && (
        <GridPrefillControls
          gridSource={gridSource}
          wasPrefilled={isGridPrefilled(existingEntries, gridOrder)}
          disabled={isPending}
          onReset={resetToGrid}
        />
      )}

      {/* Classés */}
      <div className="flex flex-col gap-1">
        <p className="px-1 text-2xs font-semibold tracking-widest text-text-secondary">
          {t('predict.ranked')}
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1">
              {selected.map((code, i) => {
                const driver = driverByCode.get(code)
                if (!driver) return null
                const isSelected = selectedCode === code
                return (
                  <SortableRow key={code} id={code} reducedMotion={reducedMotion}>
                    {(dragHandleProps, isDragging) => (
                      /* Tap = raccourci pointeur uniquement — équivalent clavier via la
                         poignée dnd-kit + boutons Monter/Descendre (cf. RaceForm). */
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                      <li
                        onClick={() => onRowTap(code)}
                        className={cn(
                          'flex cursor-pointer select-none items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-shadow',
                          isDragging && 'shadow-lg opacity-80',
                          isSelected && 'ring-2 ring-primary bg-primary/5',
                        )}
                      >
                        <span
                          className={cn('w-5 shrink-0 text-right tabular-nums text-text-secondary', reducedMotion ? 'text-base' : 'text-sm')}
                          style={positionStyle(i + 1)}
                        >
                          {i + 1}
                        </span>
                        <DriverInfo driver={driver} large={reducedMotion} />
                        {reducedMotion && (
                          <>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); moveDriverUp(i) }}
                              aria-label={`${t('predict.moveUp')} ${driver.firstName} ${driver.lastName}`}
                              disabled={i === 0}
                              className="shrink-0 p-1 text-text-secondary transition-colors hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronUp size={16} aria-hidden="true" />
                            </button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); moveDriverDown(i) }}
                              aria-label={`${t('predict.moveDown')} ${driver.firstName} ${driver.lastName}`}
                              disabled={i === selected.length - 1}
                              className="shrink-0 p-1 text-text-secondary transition-colors hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronDown size={16} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button type="button"
                          {...dragHandleProps}
                          aria-label={t('predict.reorder')}
                          className="shrink-0 touch-none cursor-grab p-1 text-text-secondary active:cursor-grabbing hover:text-foreground"
                        >
                          <GripVertical size={14} aria-hidden="true" />
                        </button>
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); remove(i) }}
                          aria-label={`${t('predict.remove')} ${driver.firstName} ${driver.lastName}`}
                          className="shrink-0 p-1 text-text-secondary transition-colors hover:text-destructive"
                        >
                          <span aria-hidden="true" className="text-base leading-none">×</span>
                        </button>
                      </li>
                    )}
                  </SortableRow>
                )
              })}
            </ol>
          </SortableContext>
        </DndContext>

        {selected.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-text-secondary">
            {t('predict.emptyClassees')}
          </p>
        )}
      </div>

      {/* Non classés */}
      {unranked.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="px-1 text-2xs font-semibold tracking-widest text-text-secondary">
            {t('predict.unranked')}
          </p>
          {unranked.some((d) => d.absentFromWeekend) && (
            <p className="px-1 text-xs text-text-muted">{t('predict.absentHint')}</p>
          )}
          <ul className="flex flex-col gap-1">
            {unranked.map((driver) => (
              <li key={driver.code} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-text-secondary"
                >
                  +
                </span>
                <DriverInfo driver={driver} />
                <button type="button"
                  onClick={() => add(driver.code)}
                  disabled={isComplete}
                  aria-label={`${t('predict.add')} ${driver.firstName} ${driver.lastName}`}
                  className="shrink-0 text-sm font-semibold text-primary-text transition-colors hover:text-primary-text/80 disabled:pointer-events-none disabled:opacity-30"
                >
                  {t('predict.add')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nudge : un absent est classé — permis, mais conséquence rappelée */}
      <AbsentRankedWarning names={rankedAbsentNames(selected, driverByCode)} />

      {/* Feedback */}
      {message && (
        <p role="status" className={cn('text-sm', message.type === 'ok' ? 'text-success' : 'text-destructive')}>
          {message.text}
        </p>
      )}

      <Button
        size="block"
        onClick={save}
        disabled={isPending || selected.length === 0}
        aria-busy={isPending}
      >
        {isPending
          ? t('predict.saving')
          : isComplete
          ? t('predict.save')
          : `${t('predict.save')} (${selected.length}/${expectedCount})`}
      </Button>
    </div>
  )
}

// ─── Public component ──────────────────────────────────────────────────────

export function PredictionForm({
  sessionId,
  sessionType,
  drivers,
  expectedCount,
  existingEntries,
  existingFastestLap,
  isLocked,
  gridOrder,
  gridSource,
  onSaved,
}: Props) {
  const driverByCode  = new Map(drivers.map((d) => [d.code, d]))
  // Seule la course se pronostique sur la grille complète (22). Le sprint race
  // ne score que le top 8 → mode « classés / non classés » comme les qualifs.
  const isRaceMode    = sessionType === 'race'

  if (isLocked) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            {isRaceMode
              ? t('predict.courseSubtitle')
              : `${t('predict.qualifsSubtitlePre')} ${expectedCount} ${t('predict.qualifsSubtitlePost')}`}
          </p>
          <Badge variant="neutral">{t('predict.locked')}</Badge>
        </div>
        <LockedView selected={existingEntries} driverByCode={driverByCode} />
      </div>
    )
  }

  if (isRaceMode) {
    return (
      <RaceForm
        sessionId={sessionId}
        drivers={drivers}
        expectedCount={expectedCount}
        existingEntries={existingEntries}
        existingFastestLap={existingFastestLap}
        gridOrder={gridOrder}
        gridSource={gridSource}
        onSaved={onSaved}
      />
    )
  }

  return (
    <QualifsForm
      sessionId={sessionId}
      drivers={drivers}
      expectedCount={expectedCount}
      existingEntries={existingEntries}
      gridOrder={gridOrder}
      gridSource={gridSource}
      onSaved={onSaved}
    />
  )
}
