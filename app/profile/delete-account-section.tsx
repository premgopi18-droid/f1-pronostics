'use client'

import { useActionState, useState } from 'react'
import { deleteAccount, type ProfileActionState } from '@/app/actions/profile'
import { t } from '@/lib/i18n'
import { translateActionError } from '@/lib/actions/errors'

const initialState: ProfileActionState = {}

export function DeleteAccountSection() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [state, action, isPending] = useActionState(deleteAccount, initialState)

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-border pt-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('profile.dangerZone')}
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="text-left text-sm text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          {t('profile.deleteAccount')}
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('profile.deleteWarning')}
          </p>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {translateActionError(state.error)}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t('profile.deleteCancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-destructive/20 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/30 disabled:opacity-50"
            >
              {isPending ? t('profile.deleting') : t('profile.deleteConfirm')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
