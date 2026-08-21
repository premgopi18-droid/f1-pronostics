'use client'

import { useState, useTransition } from 'react'
import { translateActionError } from '@/lib/actions/errors'
import { useRouter } from 'next/navigation'
import { BottomSheet } from '@/app/ui/bottom-sheet'
import { playItemAction, type PlayItemInput } from '@/app/actions/items'
import { ALLOWED_SESSIONS, SESSION_TYPES } from '@/app/actions/items-payload'
import type { ItemAvailability, ItemUnavailableReason } from '@/lib/items/availability'
import type { SessionType } from '@/lib/scoring/types'
import { t, type TranslationKey } from '@/lib/i18n'
import { SESSION_LABEL_KEY } from '@/lib/i18n/session-labels'

interface Driver {
  id:        string
  code:      string
  firstName: string
  lastName:  string
  number:    number | null
}

interface Constructor {
  id:   string
  code: string
  name: string
}

interface Member {
  userId: string
  pseudo: string
}

interface UserItem {
  itemType:      string
  usesRemaining: number
}

interface ItemLabel {
  name:        string
  description: string
  emoji:       string
}

interface Props {
  gpId:           string
  leagueId:       string
  userItems:      UserItem[]
  availability:   Record<string, ItemAvailability>
  // Item déjà joué ce week-end (affiché à part sur la page) → exclu de la liste,
  // les autres apparaissent grisés « Déjà joué ce week-end ». null si slot libre.
  playedItemType: string | null
  members:        Member[]
  drivers:        Driver[]
  constructors:   Constructor[]
  sessionTypes:   SessionType[]
  isSprintWeekend: boolean
  itemLabels:     Record<string, ItemLabel>
}

// Items supportés dans ce slice (pas wdc_move, wcc_move, fia_penalty)
const PLAYABLE_ITEMS = new Set([
  'shield', 'block_driver', 'wild_card', 'double_points',
  'dnf_prediction', 'underdog_top5', 'no_points_team',
])

// Motif de grisage d'un item indisponible (i18n approche A — clés items.unavailable.*).
const unavailableLabel = (reason: ItemUnavailableReason): string =>
  t(`items.unavailable.${reason}` as TranslationKey)

const SESSION_LABELS: Record<SessionType, string> = {
  qualifying:        t(SESSION_LABEL_KEY.qualifying),
  race:              t(SESSION_LABEL_KEY.race),
  sprint_qualifying: t(SESSION_LABEL_KEY.sprint_qualifying),
  sprint_race:       t(SESSION_LABEL_KEY.sprint_race),
}

type Step = 'choose' | 'configure' | 'confirm'

type Draft = {
  targetUserId?:    string
  driverCode?:      string
  constructorCode?: string
  sessionType?:     SessionType
}

export function PlayItemForm({
  gpId, leagueId, userItems, availability, playedItemType, members, drivers, constructors,
  sessionTypes, itemLabels,
}: Props) {
  const router = useRouter()
  const [step, setStep]               = useState<Step>('choose')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [draft, setDraft]             = useState<Draft>({})
  const [message, setMessage]         = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition]  = useTransition()

  // L'item déjà joué ce week-end est affiché à part (carte « Item joué ») → on l'exclut
  // de la liste ; les autres restent visibles mais grisés « Déjà joué ce week-end ».
  const playableUserItems = userItems.filter(
    (i) => PLAYABLE_ITEMS.has(i.itemType) && i.itemType !== playedItemType,
  )

  const chooseItem = (itemType: string) => {
    setSelectedItem(itemType)
    setDraft({})
    setMessage(null)
    // shield n'a pas de configuration — passe directement au confirm
    setStep(itemType === 'shield' ? 'confirm' : 'configure')
  }

  const back = () => {
    if (step === 'confirm') { setStep(selectedItem === 'shield' ? 'choose' : 'configure'); return }
    setStep('choose')
    setSelectedItem(null)
    setDraft({})
  }

  const submit = () => {
    if (!selectedItem) return
    const input = buildInput(selectedItem, draft)
    if (!input) return

    startTransition(async () => {
      const result = await playItemAction(gpId, leagueId, input)
      if ('error' in result) {
        setMessage({ type: 'error', text: translateActionError(result.error, result.errorVars) })
        return
      }
      setMessage({ type: 'ok', text: t('items.playedOk') })
      // Re-render du RSC parent : bascule sur l'état « item joué » (formulaire masqué)
      router.refresh()
    })
  }

  const isConfigureComplete = selectedItem ? checkConfigComplete(selectedItem, draft) : false

  if (message?.type === 'ok') {
    return (
      <div className="bg-zinc-900 rounded-xl px-4 py-6 text-center flex flex-col gap-2">
        <span className="text-3xl">{itemLabels[selectedItem!]?.emoji}</span>
        <p className="text-success font-medium">{message.text}</p>
        <p className="text-zinc-500 text-sm">Mise à jour de la page…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Étape 1 — Choisir un item */}
      {step === 'choose' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {playedItemType ? 'Tes items' : 'Tes items disponibles'}
          </h2>
          {playableUserItems.length === 0 && (
            <p className="text-zinc-500 text-sm">Plus d&apos;items disponibles pour cette saison.</p>
          )}
          <div className="flex flex-col gap-2">
            {playableUserItems.map((item) => {
              const label = itemLabels[item.itemType]
              const state = availability[item.itemType]

              // Item indisponible → grisé + motif, non cliquable (cf. product-specs §3.5).
              if (state && !state.available) {
                return (
                  <div
                    key={item.itemType}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-900 opacity-40 cursor-not-allowed"
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{label?.emoji ?? '🎮'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{label?.name ?? item.itemType}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{unavailableLabel(state.reason)}</p>
                    </div>
                  </div>
                )
              }

              return (
                <button type="button"
                  key={item.itemType}
                  onClick={() => chooseItem(item.itemType)}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                >
                  <span className="text-2xl shrink-0 mt-0.5">{label?.emoji ?? '🎮'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{label?.name ?? item.itemType}</p>
                    <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{label?.description}</p>
                  </div>
                  {item.usesRemaining > 1 && (
                    <span className="text-xs text-zinc-500 shrink-0 mt-1">×{item.usesRemaining}</span>
                  )}
                </button>
              )
            })}

            {/* Items coming soon */}
            {userItems.filter(i => !PLAYABLE_ITEMS.has(i.itemType) && i.itemType !== 'wdc_move' && i.itemType !== 'wcc_move').map((item) => {
              const label = itemLabels[item.itemType]
              return (
                <div
                  key={item.itemType}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-900 opacity-40 cursor-not-allowed"
                >
                  <span className="text-2xl shrink-0 mt-0.5">{label?.emoji ?? '🎮'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{label?.name ?? item.itemType}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">Bientôt disponible</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Étape 2 — Configurer */}
      {step === 'configure' && selectedItem && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={back} className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer">←</button>
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {itemLabels[selectedItem]?.emoji} {itemLabels[selectedItem]?.name}
            </h2>
          </div>

          <ConfigureStep
            itemType={selectedItem}
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            members={members}
            drivers={drivers}
            constructors={constructors}
            sessionTypes={sessionTypes}
          />

          {isConfigureComplete && (
            <button type="button"
              onClick={() => setStep('confirm')}
              className="bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
            >
              Continuer →
            </button>
          )}
        </section>
      )}

      {/* Étape 3 — Confirmer */}
      {step === 'confirm' && selectedItem && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={back} className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer">←</button>
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Confirmer</h2>
          </div>

          <ConfirmSummary
            draft={draft}
            itemLabel={itemLabels[selectedItem]}
            members={members}
            drivers={drivers}
            constructors={constructors}
          />

          {message?.type === 'error' && (
            <p className="text-destructive text-sm">{message.text}</p>
          )}

          <button type="button"
            onClick={submit}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isPending ? 'Envoi…' : 'Jouer cet item'}
          </button>
        </section>
      )}

    </div>
  )
}

// ── Sous-composant configuration ──────────────────────────────────────────

function ConfigureStep({
  itemType, draft, onChange, members, drivers, constructors, sessionTypes,
}: {
  itemType:     string
  draft:        Draft
  onChange:     (patch: Partial<Draft>) => void
  members:      Member[]
  drivers:      Driver[]
  constructors: Constructor[]
  sessionTypes: SessionType[]
}) {
  // Sessions ciblables = sessions du GP ∩ sessions autorisées pour CET item (cf. specs §220/238/239)
  const allowed = ALLOWED_SESSIONS[itemType] ?? SESSION_TYPES
  const targetableSessions = sessionTypes.filter((s) => allowed.has(s))

  switch (itemType) {
    case 'block_driver':
      return (
        <div className="flex flex-col gap-4">
          <SelectField
            label="Adversaire ciblé"
            value={draft.targetUserId ?? ''}
            onChange={(v) => onChange({ targetUserId: v })}
            options={members.map((m) => ({ value: m.userId, label: m.pseudo }))}
            placeholder={t('items.chooseOpponent')}
          />
          {draft.targetUserId && (
            <SelectField
              label="Session"
              value={draft.sessionType ?? ''}
              onChange={(v) => onChange({ sessionType: v as SessionType })}
              options={targetableSessions.map((s) => ({ value: s, label: SESSION_LABELS[s] }))}
              placeholder={t('items.chooseSession')}
            />
          )}
          {draft.sessionType && (
            <DriverPicker
              label="Pilote à bloquer"
              drivers={drivers}
              value={draft.driverCode ?? ''}
              onChange={(code) => onChange({ driverCode: code })}
            />
          )}
        </div>
      )

    case 'wild_card':
      return (
        <div className="flex flex-col gap-4">
          <SelectField
            label="Adversaire ciblé"
            value={draft.targetUserId ?? ''}
            onChange={(v) => onChange({ targetUserId: v })}
            options={members.map((m) => ({ value: m.userId, label: m.pseudo }))}
            placeholder={t('items.chooseOpponent')}
          />
          {draft.targetUserId && (
            <SelectField
              label="Session à voler"
              value={draft.sessionType ?? ''}
              onChange={(v) => onChange({ sessionType: v as SessionType })}
              options={targetableSessions.map((s) => ({ value: s, label: SESSION_LABELS[s] }))}
              placeholder={t('items.chooseSession')}
            />
          )}
        </div>
      )

    case 'double_points':
      return (
        <SelectField
          label="Session à doubler"
          value={draft.sessionType ?? ''}
          onChange={(v) => onChange({ sessionType: v as SessionType })}
          options={targetableSessions.map((s) => ({ value: s, label: SESSION_LABELS[s] }))}
          placeholder={t('items.chooseSession')}
        />
      )

    case 'dnf_prediction':
    case 'underdog_top5':
      return (
        <DriverPicker
          label={itemType === 'dnf_prediction' ? 'Pilote qui abandonne' : 'Pilote outsider'}
          drivers={drivers}
          value={draft.driverCode ?? ''}
          onChange={(code) => onChange({ driverCode: code })}
        />
      )

    case 'no_points_team':
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">Écurie sans point</p>
          <div className="flex flex-col gap-1">
            {constructors.map((c) => (
              <button type="button"
                key={c.code}
                onClick={() => onChange({ constructorCode: c.code })}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer text-left ${
                  draft.constructorCode === c.code
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                }`}
              >
                <span className="font-mono text-sm font-medium w-12">{c.code}</span>
                <span className="text-sm">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )

    default:
      return null
  }
}

// ── Résumé de confirmation ─────────────────────────────────────────────────

function ConfirmSummary({
  draft, itemLabel, members, drivers, constructors,
}: {
  draft:        Draft
  itemLabel:    ItemLabel | undefined
  members:      Member[]
  drivers:      Driver[]
  constructors: Constructor[]
}) {
  const targetMember   = members.find((m) => m.userId === draft.targetUserId)
  const targetDriver   = drivers.find((d) => d.code === draft.driverCode)
  const targetConstructor = constructors.find((c) => c.code === draft.constructorCode)

  return (
    <div className="bg-zinc-900 rounded-xl px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{itemLabel?.emoji}</span>
        <div>
          <p className="text-white font-medium">{itemLabel?.name}</p>
          {targetMember   && <p className="text-zinc-400 text-sm">→ {targetMember.pseudo}</p>}
          {targetDriver   && <p className="text-zinc-400 text-sm">Pilote : {targetDriver.code} · {targetDriver.firstName} {targetDriver.lastName}</p>}
          {targetConstructor && <p className="text-zinc-400 text-sm">Écurie : {targetConstructor.name}</p>}
          {draft.sessionType && <p className="text-zinc-400 text-sm">Session : {SESSION_LABELS[draft.sessionType]}</p>}
        </div>
      </div>
      <p className="text-xs text-zinc-600">
        Cet item sera résolu après la course du dimanche. Ton adversaire ne saura pas avant.
      </p>
    </div>
  )
}

// ── Helpers UI ─────────────────────────────────────────────────────────────

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label:       string
  value:       string
  onChange:    (value: string) => void
  options:     { value: string; label: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-400">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-sm transition-colors hover:bg-zinc-800 cursor-pointer"
      >
        <span className={selected ? 'text-white' : 'text-zinc-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-zinc-500">›</span>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex flex-col gap-1 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`px-4 py-3 rounded-xl text-sm text-left transition-colors cursor-pointer ${
                value === o.value
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}

function DriverPicker({
  label, drivers, value, onChange,
}: {
  label:    string
  drivers:  Driver[]
  value:    string
  onChange: (code: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
        {drivers.map((d) => (
          <button type="button"
            key={d.code}
            onClick={() => onChange(d.code)}
            className={`font-mono text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              value === d.code
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            {d.code}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Helpers logique ────────────────────────────────────────────────────────

function checkConfigComplete(itemType: string, draft: Draft): boolean {
  switch (itemType) {
    case 'shield':          return true
    case 'block_driver':    return !!(draft.targetUserId && draft.driverCode && draft.sessionType)
    case 'wild_card':       return !!(draft.targetUserId && draft.sessionType)
    case 'double_points':   return !!draft.sessionType
    case 'dnf_prediction':
    case 'underdog_top5':   return !!draft.driverCode
    case 'no_points_team':  return !!draft.constructorCode
    default:                return false
  }
}

function buildInput(itemType: string, draft: Draft): PlayItemInput | null {
  switch (itemType) {
    case 'shield':
      return { itemType: 'shield', payload: {} }

    case 'block_driver':
      if (!draft.targetUserId || !draft.driverCode || !draft.sessionType) return null
      return {
        itemType: 'block_driver',
        payload: { targetUserId: draft.targetUserId, sessionType: draft.sessionType, driverCode: draft.driverCode },
      }

    case 'wild_card':
      if (!draft.targetUserId || !draft.sessionType) return null
      return {
        itemType: 'wild_card',
        payload: { targetUserId: draft.targetUserId, sessionType: draft.sessionType },
      }

    case 'double_points':
      if (!draft.sessionType) return null
      return { itemType: 'double_points', payload: { sessionType: draft.sessionType } }

    case 'dnf_prediction':
      if (!draft.driverCode) return null
      return { itemType: 'dnf_prediction', payload: { driverCode: draft.driverCode } }

    case 'underdog_top5':
      if (!draft.driverCode) return null
      return { itemType: 'underdog_top5', payload: { driverCode: draft.driverCode } }

    case 'no_points_team':
      if (!draft.constructorCode) return null
      return { itemType: 'no_points_team', payload: { constructorCode: draft.constructorCode } }

    default:
      return null
  }
}
