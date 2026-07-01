'use client'

import { useActionState } from 'react'
import { updateProfile, type ProfileActionState } from '@/app/actions/profile'
import { PSEUDO_MIN_LENGTH, PSEUDO_MAX_LENGTH, PSEUDO_PATTERN } from '@/lib/profile/pseudo'
import { t } from '@/lib/i18n'

const initialState: ProfileActionState = {}

export function EditPseudoForm({
  pseudo,
  avatarKey,
  avatarUrl,
}: {
  pseudo:    string
  avatarKey: string | null
  avatarUrl: string | null
}) {
  const [state, action, isPending] = useActionState(updateProfile, initialState)

  return (
    <div className="flex flex-1 flex-col gap-8">
      {/* Formulaire pseudo */}
      <form action={action} className="flex flex-col gap-4">
        {/* Conserve l'avatar existant tel quel (casque + photo) — sinon la sauvegarde du pseudo les effacerait */}
        <input type="hidden" name="avatar_key" value={avatarKey ?? ''} />
        <input type="hidden" name="avatar_url" value={avatarUrl ?? ''} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pseudo" className="text-sm text-muted-foreground">
            {t('profile.pseudoLabel')}
          </label>
          <input
            id="pseudo"
            name="pseudo"
            type="text"
            defaultValue={pseudo}
            minLength={PSEUDO_MIN_LENGTH}
            maxLength={PSEUDO_MAX_LENGTH}
            pattern={PSEUDO_PATTERN.source}
            title={t('profile.errorChars')}
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

    </div>
  )
}
