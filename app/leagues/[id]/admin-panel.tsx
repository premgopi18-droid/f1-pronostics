'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleInvites, regenerateInviteCode } from '@/app/actions/league-admin'

export function AdminPanel({
  leagueId,
  inviteOpen,
}: {
  leagueId:   string
  inviteOpen: boolean
}) {
  const router = useRouter()
  const [open, setOpen]                   = useState(inviteOpen)
  const [regenConfirm, setRegenConfirm]   = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [isPendingToggle, startToggle]    = useTransition()
  const [isPendingRegen, startRegen]      = useTransition()

  const handleToggle = () => {
    startToggle(async () => {
      const result = await toggleInvites(leagueId, open)
      if (result.error) { setError(result.error); return }
      setOpen((prev) => !prev)
      setError(null)
    })
  }

  const handleRegen = () => {
    startRegen(async () => {
      const result = await regenerateInviteCode(leagueId)
      if (result.error) { setError(result.error); return }
      setRegenConfirm(false)
      setError(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Admin</h2>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Toggle inscriptions */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-white font-medium">Inscriptions</span>
          <span className={`text-xs ${open ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {open ? 'Ouvertes' : 'Fermées'}
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPendingToggle}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
            open
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'
          }`}
        >
          {isPendingToggle ? '…' : open ? 'Fermer' : 'Ouvrir'}
        </button>
      </div>

      {/* Régénérer le lien */}
      {!regenConfirm ? (
        <button
          type="button"
          onClick={() => setRegenConfirm(true)}
          className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors text-left px-1 cursor-pointer"
        >
          Régénérer le lien d&apos;invitation
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 px-1">
            L&apos;ancien lien ne fonctionnera plus. Les membres actuels ne sont pas affectés.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRegenConfirm(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleRegen}
              disabled={isPendingRegen}
              className="flex-1 bg-red-900/50 hover:bg-red-900/80 disabled:opacity-50 text-red-400 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
            >
              {isPendingRegen ? '…' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
