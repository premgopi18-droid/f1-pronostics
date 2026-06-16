'use client'

import { useActionState } from 'react'
import { createLeagueAction } from '@/app/actions/leagues'
import { SubmitButton } from '@/app/ui/submit-button'

export function CreateLeagueForm() {
  const [state, action] = useActionState(createLeagueAction, null)

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error && (
        <p className="text-red-400 text-sm">{state.error}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-zinc-400">
          Nom de la ligue
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={50}
          placeholder="Les Dingos de la F1"
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="maxMembers" className="text-sm text-zinc-400">
          Nombre max de joueurs
        </label>
        <select
          id="maxMembers"
          name="maxMembers"
          defaultValue="10"
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-zinc-500 transition-colors"
        >
          {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => (
            <option key={n} value={n}>{n} joueurs</option>
          ))}
        </select>
      </div>

      <SubmitButton label="Créer la ligue" />
    </form>
  )
}
