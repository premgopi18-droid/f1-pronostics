'use client'

import { useActionState } from 'react'
import { joinLeagueAction } from '@/app/actions/leagues'
import { SubmitButton } from '@/app/ui/submit-button'
import { t, type TranslationKey } from '@/lib/i18n'

export function JoinLeagueForm({ initialCode }: { initialCode?: string }) {
  const [state, action] = useActionState(joinLeagueAction, null)

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.errorCode && (
        <p className="text-sm text-destructive" aria-live="polite">
          {t(`join.error.${state.errorCode}` as TranslationKey)}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inviteCode" className="text-sm text-text-secondary">
          {t('join.manualLabel')}
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          required
          defaultValue={initialCode}
          placeholder="ABCD1234"
          autoCapitalize="characters"
          className="rounded-xl border border-border bg-card px-4 py-2.5 font-mono uppercase tracking-widest text-foreground outline-none transition-colors placeholder:text-text-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <SubmitButton label={t('join.cta')} size="block" />
    </form>
  )
}
