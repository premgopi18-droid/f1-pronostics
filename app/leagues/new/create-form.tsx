'use client'

import { useState, useActionState } from 'react'
import { createLeagueAction } from '@/app/actions/leagues'
import { t } from '@/lib/i18n'
import { Button } from '@/app/ui/button'

const MIN_MEMBERS = 2
const MAX_MEMBERS = 20
const DEFAULT_MEMBERS = 12

export function CreateLeagueForm() {
  const [state, action] = useActionState(createLeagueAction, null)
  const [maxMembers, setMaxMembers] = useState(DEFAULT_MEMBERS)

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.errorCode && (
        <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {t(`createLeague.error.${state.errorCode}`)}
        </p>
      )}

      {/* Nom */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="name"
          className="text-sm font-semibold text-foreground"
        >
          {t('createLeague.nameLabel')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={50}
          placeholder={t('createLeague.namePlaceholder')}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-text-muted transition-colors focus:border-primary focus:outline-none"
        />
      </div>

      {/* Slider nombre max de membres */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="maxMembersRange"
            className="text-sm font-semibold text-foreground"
          >
            {t('createLeague.membersLabel')}
          </label>
          <span className="font-numeric text-2xl font-bold text-foreground tabular-nums">
            {maxMembers}
          </span>
        </div>
        <input
          id="maxMembersRange"
          name="maxMembers"
          type="range"
          min={MIN_MEMBERS}
          max={MAX_MEMBERS}
          step={1}
          value={maxMembers}
          onChange={(e) => setMaxMembers(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
          aria-valuemin={MIN_MEMBERS}
          aria-valuemax={MAX_MEMBERS}
          aria-valuenow={maxMembers}
        />
        <div className="flex justify-between text-2xs text-text-muted">
          <span>{MIN_MEMBERS}</span>
          <span>{t('createLeague.hardCap')}</span>
        </div>
      </div>

      {/* Info admin */}
      <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-foreground">
        {t('createLeague.infoTextPre')}{' '}
        <strong className="font-semibold text-primary">{t('createLeague.infoAdmin')}</strong>
        {t('createLeague.infoTextPost')}
      </div>

      <Button
        type="submit"
        variant="accent"
        size="block"
      >
        {t('createLeague.submit')}
      </Button>
    </form>
  )
}
