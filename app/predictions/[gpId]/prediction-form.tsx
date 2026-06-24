'use client'

import { useState, useTransition } from 'react'
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
import { GripVertical } from 'lucide-react'
import { submitPredictionAction, submitFastestLapAction } from '@/app/actions/predictions'
import { TEAM_COLORS } from '@/lib/f1/team-colors'
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'
import { buildRaceOrder } from '@/lib/predictions/helpers'
import { t } from '@/lib/i18n'
import { Badge } from '@/app/ui/badge'
import { Button } from '@/app/ui/button'
import { BottomSheet } from '@/app/ui/bottom-sheet'
import { cn } from '@/lib/utils'
import type { SessionType } from '@/lib/scoring/types'

export interface Driver {
  id:        string
  code:      string
  firstName: string
  lastName:  string
  number:    number
  teamCode:  string
  teamName:  string
}

interface Props {
  sessionId:          string
  sessionType:        SessionType
  drivers:            Driver[]
  expectedCount:      number
  existingEntries:    string[]
  existingFastestLap: string | null
  isLocked:           boolean
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

// ─── Driver row (shared visual, different variants) ────────────────────────

function DriverInfo({ driver, position }: { driver: Driver; position?: number }) {
  const teamColor = TEAM_COLORS[driver.teamCode] ?? '#888'
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-semibold text-foreground" style={position ? positionStyle(position) : undefined}>
        {driver.firstName} {driver.lastName}
      </span>
      <span className="text-2xs font-medium" style={{ color: teamColor }}>
        {driver.teamName}
      </span>
    </div>
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
  existingEntries,
  existingFastestLap,
  onSaved,
}: {
  sessionId:          string
  drivers:            Driver[]
  existingEntries:    string[]
  existingFastestLap: string | null
  onSaved?:           (entries: string[]) => void
}) {
  const allCodes = drivers.map((d) => d.code)

  const [selected,           setSelected]           = useState<string[]>(() => buildRaceOrder(existingEntries, allCodes))
  const [fastestLap,         setFastestLap]         = useState(existingFastestLap ?? '')
  const [fastestLapSheetOpen, setFastestLapSheetOpen] = useState(false)
  const [message,            setMessage]            = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending,  startTransition] = useTransition()
  const reducedMotion = usePrefersReducedMotion()

  const driverByCode = new Map(drivers.map((d) => [d.code, d]))

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

  const save = () => {
    startTransition(async () => {
      const result = await submitPredictionAction(sessionId, selected)
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      if (fastestLap) {
        const flDriver = drivers.find((d) => d.code === fastestLap)
        if (flDriver) {
          const flResult = await submitFastestLapAction(sessionId, flDriver.id)
          if ('error' in flResult) {
            setMessage({ type: 'error', text: flResult.error })
            return
          }
        }
      }
      setMessage({ type: 'ok', text: t('predict.savedOk') })
      onSaved?.(selected)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subtitle */}
      <p className="text-xs text-text-secondary">{t('predict.courseSubtitle')}</p>

      {/* Sortable driver list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={selected} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1">
            {selected.map((code, i) => {
              const driver = driverByCode.get(code)
              if (!driver) return null
              return (
                <SortableRow key={code} id={code} reducedMotion={reducedMotion}>
                  {(dragHandleProps, isDragging) => (
                    <li
                      className={cn(
                        'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-shadow',
                        isDragging && 'shadow-lg opacity-80',
                      )}
                    >
                      <span className="w-5 shrink-0 text-right text-sm tabular-nums text-text-secondary" style={positionStyle(i + 1)}>
                        {i + 1}
                      </span>
                      <DriverInfo driver={driver} position={i + 1} />
                      <button
                        {...dragHandleProps}
                        aria-label={t('predict.reorder')}
                        className="shrink-0 touch-none cursor-grab p-1 text-text-secondary active:cursor-grabbing hover:text-foreground"
                      >
                        <GripVertical size={16} aria-hidden="true" />
                      </button>
                    </li>
                  )}
                </SortableRow>
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>

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
            <span className="font-mono font-semibold text-primary">{fastestLap}</span>
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
                <span>{d.firstName} {d.lastName}</span>
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
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? t('predict.saving') : t('predict.save')}
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
  onSaved,
}: {
  sessionId:       string
  drivers:         Driver[]
  expectedCount:   number
  existingEntries: string[]
  onSaved?:        (entries: string[]) => void
}) {
  const [selected,  setSelected]   = useState<string[]>(existingEntries)
  const [message,   setMessage]    = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const reducedMotion = usePrefersReducedMotion()

  const driverByCode = new Map(drivers.map((d) => [d.code, d]))
  const unranked     = drivers.filter((d) => !selected.includes(d.code))
  const isComplete   = selected.length === expectedCount

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

  const save = () => {
    startTransition(async () => {
      const result = await submitPredictionAction(sessionId, selected)
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setMessage({ type: 'ok', text: t('predict.savedOk') })
      onSaved?.(selected)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subtitle + counter */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {t('predict.qualifsSubtitlePre')} {expectedCount} {t('predict.qualifsSubtitlePost')}
        </p>
        <span className={cn('text-xs font-semibold tabular-nums', isComplete ? 'text-success' : 'text-text-secondary')}>
          {selected.length}/{expectedCount}
        </span>
      </div>

      {/* Classés */}
      <div className="flex flex-col gap-1">
        <p className="px-1 text-2xs font-semibold tracking-widest text-text-secondary">
          {t('predict.ranked')}
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1">
              {selected.map((code, i) => {
                const driver = driverByCode.get(code)
                if (!driver) return null
                return (
                  <SortableRow key={code} id={code} reducedMotion={reducedMotion}>
                    {(dragHandleProps, isDragging) => (
                      <li
                        className={cn(
                          'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-shadow',
                          isDragging && 'shadow-lg opacity-80',
                        )}
                      >
                        <span className="w-5 shrink-0 text-right text-sm tabular-nums text-text-secondary" style={positionStyle(i + 1)}>
                          {i + 1}
                        </span>
                        <DriverInfo driver={driver} />
                        <button
                          {...dragHandleProps}
                          aria-label={t('predict.reorder')}
                          className="shrink-0 touch-none cursor-grab p-1 text-text-secondary active:cursor-grabbing hover:text-foreground"
                        >
                          <GripVertical size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => remove(i)}
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
                <button
                  onClick={() => add(driver.code)}
                  disabled={isComplete}
                  aria-label={`${t('predict.add')} ${driver.firstName} ${driver.lastName}`}
                  className="shrink-0 text-sm font-semibold text-primary transition-colors hover:text-primary/80 disabled:pointer-events-none disabled:opacity-30"
                >
                  {t('predict.add')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        existingEntries={existingEntries}
        existingFastestLap={existingFastestLap}
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
      onSaved={onSaved}
    />
  )
}
