'use client'

import { useActionState } from 'react'
import { joinLeagueAction } from '@/app/actions/leagues'
import { SubmitButton } from '@/app/ui/submit-button'

export function JoinLeagueForm({ initialCode }: { initialCode?: string }) {
  const [state, action] = useActionState(joinLeagueAction, null)

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error && (
        <p className="text-red-400 text-sm">{state.error}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inviteCode" className="text-sm text-zinc-400">
          Code d'invitation
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          required
          defaultValue={initialCode}
          placeholder="ABCD1234"
          autoCapitalize="characters"
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors uppercase tracking-widest font-mono"
        />
      </div>

      <SubmitButton label="Rejoindre la ligue" />
    </form>
  )
}
