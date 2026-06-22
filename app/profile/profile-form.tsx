'use client'

import { useActionState, useState } from 'react'
import { updateProfile, deleteAccount, type ProfileActionState } from '@/app/actions/profile'
import { HelmetPicker } from '@/app/components/helmet-picker'

const initialState: ProfileActionState = {}

export function ProfileForm({
  pseudo,
  avatarKey,
  email,
}: {
  pseudo:    string
  avatarKey: string | null
  email:     string
}) {
  const [updateState, updateAction, isUpdating] = useActionState(updateProfile, initialState)
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteAccount, initialState)
  const [selectedAvatar, setSelectedAvatar]     = useState<string | null>(avatarKey)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <div className="flex flex-col gap-8">

      {/* Formulaire édition */}
      <form action={updateAction} className="flex flex-col gap-6">
        <input type="hidden" name="avatar_key" value={selectedAvatar ?? ''} />

        {/* Email — lecture seule */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-zinc-400">Email</span>
          <div className="px-4 py-3 rounded-xl bg-zinc-900 text-zinc-500 text-sm">{email}</div>
        </div>

        {/* Pseudo */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pseudo" className="text-sm text-zinc-400">Pseudo</label>
          <input
            id="pseudo"
            name="pseudo"
            type="text"
            defaultValue={pseudo}
            minLength={2}
            maxLength={30}
            required
            className="px-4 py-3 rounded-xl bg-zinc-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Avatar */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">Avatar</span>
          <HelmetPicker value={selectedAvatar} onChange={setSelectedAvatar} />
        </div>

        {updateState.error && (
          <p className="text-sm text-red-400">{updateState.error}</p>
        )}
        {updateState.success && (
          <p className="text-sm text-emerald-400">Profil mis à jour !</p>
        )}

        <button
          type="submit"
          disabled={isUpdating}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-center transition-colors"
        >
          {isUpdating ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      {/* Suppression de compte */}
      <div className="flex flex-col gap-3 pt-6 border-t border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Zone dangereuse</h2>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-zinc-600 hover:text-red-400 transition-colors text-left"
          >
            Supprimer mon compte
          </button>
        ) : (
          <form action={deleteAction} className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Ton compte sera anonymisé — tes scores passés sont conservés pour l&apos;intégrité du classement. Cette action est irréversible.
            </p>
            {deleteState.error && (
              <p className="text-sm text-red-400">{deleteState.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isDeleting}
                className="flex-1 bg-red-900/50 hover:bg-red-900/80 disabled:opacity-50 text-red-400 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                {isDeleting ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  )
}
