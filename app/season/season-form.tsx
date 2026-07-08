'use client'

import { useState, useTransition } from 'react'
import { translateActionError } from '@/lib/actions/errors'
import { t } from '@/lib/i18n'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  submitSeasonPredictionAction,
  applySeasonItemAction,
} from '@/app/actions/season-predictions'
import { BottomSheet } from '@/app/ui/bottom-sheet'
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'
import { useTapSelect } from '@/lib/hooks/use-tap-select'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface Driver {
  code:      string
  firstName: string
  lastName:  string
}

interface Constructor {
  code: string
  name: string
}

interface SeasonItems {
  wdcMove: number
  wccMove: number
}

interface Props {
  drivers:          Driver[]
  constructors:     Constructor[]
  initialWdc:       string[] | null
  initialWcc:       string[] | null
  isSubmissionOpen: boolean
  isItemsOpen:      boolean
  seasonItems:      SeasonItems
}

const DRAG_ACTIVATION_DISTANCE = 6

type Tab = 'wdc' | 'wcc'

// Construit la liste complète ordonnée : d'abord les entrées sauvegardées (dans
// l'ordre), puis les pilotes/écuries restants non encore classés (pour WDC).
function buildFullEntries(saved: string[] | null, allCodes: string[]): string[] {
  if (!saved) return allCodes
  const savedSet = new Set(saved)
  const remaining = allCodes.filter((c) => !savedSet.has(c))
  return [...saved, ...remaining]
}

// ── Composant principal ────────────────────────────────────────────────────

export function SeasonForm({
  drivers,
  constructors,
  initialWdc,
  initialWcc,
  isSubmissionOpen,
  isItemsOpen,
  seasonItems,
}: Props) {
  const [tab, setTab] = useState<Tab>('wdc')

  const allDriverCodes      = drivers.map((d) => d.code)
  const allConstructorCodes = constructors.map((c) => c.code)

  // State remonté ici pour survivre aux switch d'onglet
  const [wdcEntries, setWdcEntries] = useState<string[]>(() =>
    buildFullEntries(initialWdc, allDriverCodes),
  )
  const [wccEntries, setWccEntries] = useState<string[]>(() =>
    buildFullEntries(initialWcc, allConstructorCodes),
  )

  const driverLabels      = new Map(drivers.map((d) => [d.code, `${d.code} · ${d.firstName} ${d.lastName}`]))
  const constructorLabels = new Map(constructors.map((c) => [c.code, `${c.code} · ${c.name}`]))

  return (
    <div className="flex flex-col gap-6">

      {/* Onglets WDC / WCC */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {(['wdc', 'wcc'] as Tab[]).map((t) => (
          <button type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t === 'wdc' ? '🏆 WDC — Pilotes' : '🏗️ WCC — Écuries'}
          </button>
        ))}
      </div>

      {tab === 'wdc' && (
        <RankingPanel
          type="wdc"
          label="Top 10 pilotes en fin de saison — glisse les 10 premiers"
          predictionCount={10}
          entries={wdcEntries}
          onEntriesChange={setWdcEntries}
          labels={driverLabels}
          isSubmissionOpen={isSubmissionOpen}
          isItemsOpen={isItemsOpen}
          itemUsesRemaining={seasonItems.wdcMove}
          itemType="wdc_move"
          itemEmoji="🔧"
          itemName="Coup de clé à molette"
          hasSaved={initialWdc !== null}
        />
      )}

      {tab === 'wcc' && (
        <RankingPanel
          type="wcc"
          label="Classement complet des 11 écuries"
          predictionCount={11}
          entries={wccEntries}
          onEntriesChange={setWccEntries}
          labels={constructorLabels}
          isSubmissionOpen={isSubmissionOpen}
          isItemsOpen={isItemsOpen}
          itemUsesRemaining={seasonItems.wccMove}
          itemType="wcc_move"
          itemEmoji="🚀"
          itemName="Boost turbo"
          hasSaved={initialWcc !== null}
        />
      )}

    </div>
  )
}

// ── Panneau de classement (WDC ou WCC) ────────────────────────────────────

function RankingPanel({
  type,
  label,
  predictionCount,
  entries,
  onEntriesChange,
  labels,
  isSubmissionOpen,
  isItemsOpen,
  itemUsesRemaining,
  itemType,
  itemEmoji,
  itemName,
  hasSaved,
}: {
  type:               'wdc' | 'wcc'
  label:              string
  predictionCount:    number
  entries:            string[]
  onEntriesChange:    (entries: string[]) => void
  labels:             Map<string, string>
  isSubmissionOpen:   boolean
  isItemsOpen:        boolean
  itemUsesRemaining:  number
  itemType:           'wdc_move' | 'wcc_move'
  itemEmoji:          string
  itemName:           string
  hasSaved:           boolean
}) {
  const [message, setMessage]       = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [itemFrom,       setItemFrom]       = useState<number>(1)
  const [itemTo,         setItemTo]         = useState<number>(2)
  const [fromSheetOpen,  setFromSheetOpen]  = useState(false)
  const [toSheetOpen,    setToSheetOpen]    = useState(false)
  const [showItem,       setShowItem]       = useState(false)
  // Suit si une prédiction a été soumise au moins une fois dans cette session
  const [savedOnce, setSavedOnce]   = useState(hasSaved)
  // Stock d'item suivi côté client pour refléter immédiatement une utilisation
  // (le prop initial vient du serveur ; on décrémente après un usage réussi).
  const [usesLeft, setUsesLeft]     = useState(itemUsesRemaining)

  const reducedMotion = usePrefersReducedMotion()

  const { selectedCode, onRowTap, onDragStart } = useTapSelect(
    entries,
    (newItems) => { onEntriesChange(newItems); setMessage(null) },
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onEntriesChange(arrayMove(entries, entries.indexOf(active.id as string), entries.indexOf(over.id as string)))
      setMessage(null)
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= entries.length) return
    onEntriesChange(arrayMove(entries, index, newIndex))
    setMessage(null)
  }

  const submit = () => {
    setMessage(null)
    startTransition(async () => {
      // Pour WDC : on soumet les predictionCount premiers seulement
      const toSubmit = entries.slice(0, predictionCount)
      const result = await submitSeasonPredictionAction(type, toSubmit)
      if ('error' in result) {
        setMessage({ type: 'error', text: translateActionError(result.error, result.errorVars) })
      } else {
        setMessage({ type: 'ok', text: t('season.savedOk') })
        setSavedOnce(true)
      }
    })
  }

  const applyItem = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await applySeasonItemAction(itemType, itemFrom, itemTo)
      if ('error' in result) {
        setMessage({ type: 'error', text: translateActionError(result.error, result.errorVars) })
      } else {
        onEntriesChange((() => {
          const next = [...entries]
          const [extracted] = next.splice(itemFrom - 1, 1)
          next.splice(itemTo - 1, 0, extracted)
          return next
        })())
        setMessage({ type: 'ok', text: `${itemName} utilisé !` })
        setShowItem(false)
        setUsesLeft((u) => u - 1)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext items={entries} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {entries.map((code, index) => (
              <SortableRow
                key={code}
                id={code}
                position={index + 1}
                label={labels.get(code) ?? code}
                disabled={!isSubmissionOpen}
                isSelected={selectedCode === code}
                onTap={isSubmissionOpen ? () => onRowTap(code) : undefined}
                reducedMotion={reducedMotion}
                onMoveUp={index > 0 ? () => move(index, -1) : undefined}
                onMoveDown={index < entries.length - 1 ? () => move(index, 1) : undefined}
                predictionCount={predictionCount}
                isLastInPrediction={index === predictionCount - 1 && predictionCount < entries.length}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}

      {isSubmissionOpen && (
        <button type="button"
          onClick={submit}
          disabled={isPending}
          className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? 'Enregistrement…' : savedOnce ? 'Mettre à jour' : 'Enregistrer'}
        </button>
      )}

      {/* Section item saison — disponible uniquement une fois les pronostics verrouillés */}
      {isItemsOpen && !isSubmissionOpen && usesLeft > 0 && savedOnce && (
        <div className="border border-zinc-800 rounded-xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{itemEmoji} {itemName}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{t('season.itemPanelSubtitle')}</p>
            </div>
            <span className="text-xs text-zinc-500">×{usesLeft}</span>
          </div>

          {!showItem ? (
            <button type="button"
              onClick={() => setShowItem(true)}
              className="text-sm text-destructive hover:text-destructive/80 transition-colors cursor-pointer text-left"
            >
              {t('season.use')} →
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-zinc-400">Depuis la position</label>
                  <button
                    type="button"
                    onClick={() => setFromSheetOpen(true)}
                    className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-800 cursor-pointer text-white"
                  >
                    <span className="font-mono">P{itemFrom} · {labels.get(entries[itemFrom - 1]) ?? entries[itemFrom - 1]}</span>
                    <span className="text-zinc-500">›</span>
                  </button>
                  <BottomSheet open={fromSheetOpen} onClose={() => setFromSheetOpen(false)} title={t('season.moveFromTitle')}>
                    <div className="flex flex-col gap-1 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
                      {entries.slice(0, predictionCount).map((code, i) => {
                        const pos = i + 1
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setItemFrom(pos)
                              // Garde `itemTo` valide : il ne doit jamais égaler `itemFrom`
                              if (itemTo === pos) setItemTo(pos === 1 ? 2 : 1)
                              setFromSheetOpen(false)
                            }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors cursor-pointer ${
                              itemFrom === pos
                                ? 'bg-red-600 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            }`}
                          >
                            <span className="font-mono text-xs w-6 shrink-0">P{pos}</span>
                            <span className="truncate">{labels.get(code) ?? code}</span>
                          </button>
                        )
                      })}
                    </div>
                  </BottomSheet>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-zinc-400">Vers la position</label>
                  <button
                    type="button"
                    onClick={() => setToSheetOpen(true)}
                    className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-800 cursor-pointer text-white"
                  >
                    <span className="font-mono">P{itemTo} · {labels.get(entries[itemTo - 1]) ?? entries[itemTo - 1]}</span>
                    <span className="text-zinc-500">›</span>
                  </button>
                  <BottomSheet open={toSheetOpen} onClose={() => setToSheetOpen(false)} title={t('season.moveToTitle')}>
                    <div className="flex flex-col gap-1 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
                      {entries.slice(0, predictionCount).map((code, i) => {
                        const pos = i + 1
                        if (pos === itemFrom) return null
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => { setItemTo(pos); setToSheetOpen(false) }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors cursor-pointer ${
                              itemTo === pos
                                ? 'bg-red-600 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            }`}
                          >
                            <span className="font-mono text-xs w-6 shrink-0">P{pos}</span>
                            <span className="truncate">{labels.get(code) ?? code}</span>
                          </button>
                        )
                      })}
                    </div>
                  </BottomSheet>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={applyItem}
                  disabled={isPending || itemFrom === itemTo}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPending ? t('season.sending') : t('season.confirm')}
                </button>
                <button type="button"
                  onClick={() => setShowItem(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer"
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

// ── Ligne sortable ─────────────────────────────────────────────────────────

function SortableRow({
  id,
  position,
  label,
  disabled,
  isSelected,
  onTap,
  reducedMotion,
  onMoveUp,
  onMoveDown,
  predictionCount,
  isLastInPrediction,
}: {
  id:                  string
  position:            number
  label:               string
  disabled:            boolean
  isSelected:          boolean
  onTap?:              () => void
  reducedMotion:       boolean
  onMoveUp?:           () => void
  onMoveDown?:         () => void
  predictionCount:     number
  isLastInPrediction:  boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: reducedMotion ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isInPrediction = position <= predictionCount

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={onTap}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
          isInPrediction ? 'bg-zinc-900' : 'bg-zinc-950 opacity-40',
          isDragging && 'ring-1 ring-zinc-600',
          isSelected && 'ring-2 ring-primary bg-primary/5',
          onTap && 'cursor-pointer select-none',
        )}
      >
        {!disabled && (
          <button type="button"
            {...attributes}
            {...listeners}
            className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing touch-none shrink-0"
            tabIndex={-1}
            aria-label={t('season.moveHandle')}
          >
            ⠿
          </button>
        )}

        <span className={`text-sm tabular-nums w-6 text-right shrink-0 ${
          isInPrediction ? 'text-zinc-400' : 'text-zinc-600'
        }`}>
          {position}
        </span>

        <span className={`flex-1 text-sm font-mono ${isInPrediction ? 'text-white' : 'text-zinc-600'}`}>
          {label}
        </span>

        {!disabled && reducedMotion && (
          <div className="flex gap-1 shrink-0">
            <button type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
              disabled={!onMoveUp}
              className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
              aria-label={t('season.moveUp')}
            >↑</button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
              disabled={!onMoveDown}
              className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
              aria-label={t('season.moveDown')}
            >↓</button>
          </div>
        )}
      </div>

      {/* Séparateur visuel entre la prédiction et le reste (WDC seulement) */}
      {isLastInPrediction && (
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600">hors top {predictionCount}</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
      )}
    </>
  )
}
