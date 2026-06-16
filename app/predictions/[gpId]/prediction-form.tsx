'use client'

import { useState, useTransition } from 'react'
import { submitPredictionAction, submitFastestLapAction } from '@/app/actions/predictions'
import type { SessionType } from '@/lib/scoring/types'

interface Driver {
  id:        string
  code:      string
  firstName: string
  lastName:  string
  number:    number
}

interface Props {
  sessionId:          string
  sessionType:        SessionType
  drivers:            Driver[]
  expectedCount:      number
  existingEntries:    string[]
  existingFastestLap: string | null  // driver code, race only
  isLocked:           boolean
}

const SESSION_LABELS: Record<SessionType, string> = {
  qualifying:        'Qualifications',
  race:              'Course',
  sprint_qualifying: 'Sprint Qualifying',
  sprint_race:       'Sprint Race',
}

export function PredictionForm({
  sessionId, sessionType, drivers, expectedCount,
  existingEntries, existingFastestLap, isLocked,
}: Props) {
  const [selected, setSelected]     = useState<string[]>(existingEntries)
  const [fastestLap, setFastestLap] = useState<string>(existingFastestLap ?? '')
  const [message, setMessage]       = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const driverByCode = new Map(drivers.map((d) => [d.code, d]))
  const remaining    = drivers.filter((d) => !selected.includes(d.code))
  const isComplete   = selected.length === expectedCount

  const addDriver = (code: string) => {
    if (selected.length >= expectedCount || selected.includes(code)) return
    setSelected((prev) => [...prev, code])
    setMessage(null)
  }

  const removeDriver = (index: number) => {
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
      // Meilleur tour pour la course
      if (sessionType === 'race' && fastestLap) {
        const flDriver = drivers.find((d) => d.code === fastestLap)
        if (flDriver) {
          const flResult = await submitFastestLapAction(sessionId, flDriver.id)
          if ('error' in flResult) {
            setMessage({ type: 'error', text: flResult.error })
            return
          }
        }
      }
      setMessage({ type: 'ok', text: 'Pronostic enregistré !' })
    })
  }

  if (isLocked) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">{SESSION_LABELS[sessionType]}</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">Verrouillé</span>
        </div>
        {selected.length > 0 ? (
          <ol className="flex flex-col gap-1">
            {selected.map((code, i) => {
              const d = driverByCode.get(code)
              return (
                <li key={code} className="flex items-center gap-3 px-3 py-2 bg-zinc-900 rounded-lg">
                  <span className="text-zinc-500 text-sm w-5 text-right tabular-nums">{i + 1}</span>
                  <span className="font-mono text-sm text-zinc-400 w-8">{code}</span>
                  <span className="text-white text-sm">{d ? `${d.firstName} ${d.lastName}` : code}</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-zinc-500 text-sm">Aucun pronostic soumis</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">{SESSION_LABELS[sessionType]}</h2>
        <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
          Ouvert
        </span>
      </div>

      {/* Slots de la prédiction */}
      <div className="flex flex-col gap-1">
        {Array.from({ length: expectedCount }, (_, i) => {
          const code = selected[i]
          const d    = code ? driverByCode.get(code) : null
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-zinc-900 rounded-lg min-h-[40px]">
              <span className="text-zinc-500 text-sm w-5 text-right tabular-nums shrink-0">{i + 1}</span>
              {code ? (
                <>
                  <span className="font-mono text-sm text-zinc-400 w-8 shrink-0">{code}</span>
                  <span className="text-white text-sm flex-1">{d ? `${d.firstName} ${d.lastName}` : code}</span>
                  <button
                    onClick={() => removeDriver(i)}
                    className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors shrink-0 cursor-pointer"
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className="text-zinc-700 text-sm">—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Meilleur tour (course uniquement) */}
      {sessionType === 'race' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">Meilleur tour</p>
          <select
            value={fastestLap}
            onChange={(e) => setFastestLap(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
          >
            <option value="">— Choisir un pilote</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.code}>
                {d.code} · {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pilotes disponibles */}
      {remaining.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">
            Pilotes disponibles — appuie pour ajouter
            <span className="ml-2 text-zinc-600">({selected.length}/{expectedCount})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((d) => (
              <button
                key={d.code}
                onClick={() => addDriver(d.code)}
                disabled={isComplete}
                className="font-mono text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
              >
                {d.code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedback + bouton */}
      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={isPending || selected.length === 0}
        className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Enregistrement…' : isComplete ? 'Enregistrer' : `Enregistrer (${selected.length}/${expectedCount})`}
      </button>
    </div>
  )
}
