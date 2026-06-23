'use client'

import { useActionState, useState } from 'react'
import { updateProfile, type ProfileActionState } from '@/app/actions/profile'
import { HelmetPicker } from '@/app/components/helmet-picker'
import { t } from '@/lib/i18n'

const initialState: ProfileActionState = {}

export function EditAvatarForm({
  pseudo,
  avatarKey,
}: {
  pseudo:    string
  avatarKey: string | null
}) {
  const [state, action, isPending]       = useActionState(updateProfile, initialState)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(avatarKey)

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Conserve le pseudo existant tel quel */}
      <input type="hidden" name="pseudo" value={pseudo} />
      <input type="hidden" name="avatar_key" value={selectedAvatar ?? ''} />

      <HelmetPicker value={selectedAvatar} onChange={setSelectedAvatar} />

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
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
  )
}
