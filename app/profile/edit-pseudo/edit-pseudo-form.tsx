'use client'

import { useActionState, useState } from 'react'
import { updateProfile, deleteAccount, type ProfileActionState } from '@/app/actions/profile'
import { t } from '@/lib/i18n'

const initialState: ProfileActionState = {}

export function EditPseudoForm({
  pseudo,
  avatarKey,
}: {
  pseudo:    string
  avatarKey: string | null
}) {
  const [state, action, isPending]              = useActionState(updateProfile, initialState)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteAccount, initialState)

  return (
    <div className="flex flex-1 flex-col gap-8">
      {/* Formulaire pseudo */}
      <form action={action} className="flex flex-col gap-4">
        {/* Conserve l'avatar existant tel quel */}
        <input type="hidden" name="avatar_key" value={avatarKey ?? ''} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pseudo" className="text-sm text-muted-foreground">
            {t('profile.pseudoLabel')}
          </label>
          <input
            id="pseudo"
            name="pseudo"
            type="text"
            defaultValue={pseudo}
            minLength={2}
            maxLength={30}
            required
            autoComplete="nickname"
            className="rounded-xl bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {t(state.error)}
          </p>
        )}
        {state.success && (
          <p className="text-sm text-emerald-400" role="status">
            {t('profile.savedOk')}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
        >
          {isPending ? t('profile.saving') : t('profile.save')}
        </button>
      </form>

      {/* Zone dangereuse */}
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('profile.dangerZone')}
        </p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-left text-sm text-muted-foreground/60 transition-colors hover:text-destructive"
          >
            {t('profile.deleteAccount')}
          </button>
        ) : (
          <form action={deleteAction} className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('profile.deleteWarning')}
            </p>
            {deleteState.error && (
              <p className="text-sm text-destructive" role="alert">
                {t(deleteState.error)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t('profile.deleteCancel')}
              </button>
              <button
                type="submit"
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-destructive/20 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/30 disabled:opacity-50"
              >
                {isDeleting ? t('profile.deleting') : t('profile.deleteConfirm')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
