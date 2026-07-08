'use client'

import { useState, useTransition, useSyncExternalStore } from 'react'
import { translateActionError } from '@/lib/actions/errors'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toggleInvites, regenerateInviteCode, transferAdmin } from '@/app/actions/league-admin'
import { UserAvatar } from '@/app/components/user-avatar'
import { Badge } from '@/app/ui/badge'
import { Button } from '@/app/ui/button'
import { t } from '@/lib/i18n'
import type { AdminMember } from './page'

const subscribeNoop = () => () => {}
const getOrigin = () => window.location.origin
const getServerOrigin = () => ''

export function AdminClient({
  leagueId,
  inviteCode,
  inviteOpen,
  members,
  currentUserId,
}: {
  leagueId: string
  inviteCode: string
  inviteOpen: boolean
  members: AdminMember[]
  currentUserId: string
}) {
  const router = useRouter()
  const origin = useSyncExternalStore(subscribeNoop, getOrigin, getServerOrigin)
  const fullUrl = origin ? `${origin}/leagues/join?code=${inviteCode}` : `/leagues/join?code=${inviteCode}`

  const [open, setOpen] = useState(inviteOpen)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [regenConfirm, setRegenConfirm] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isPendingToggle, startToggle] = useTransition()
  const [isPendingRegen, startRegen] = useTransition()
  const [isPendingTransfer, startTransfer] = useTransition()

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch { /* clipboard indisponible */ }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch { /* clipboard indisponible */ }
  }

  const handleToggle = () => {
    startToggle(async () => {
      const result = await toggleInvites(leagueId)
      if (result.error) { setError(translateActionError(result.error)); return }
      if (typeof result.inviteOpen === 'boolean') setOpen(result.inviteOpen)
      setError(null)
    })
  }

  const handleRegen = () => {
    startRegen(async () => {
      const result = await regenerateInviteCode(leagueId)
      if (result.error) { setError(translateActionError(result.error)); return }
      setRegenConfirm(false)
      setError(null)
      router.refresh()
    })
  }

  const handleTransfer = (targetUserId: string) => {
    startTransfer(async () => {
      const result = await transferAdmin(leagueId, targetUserId)
      if (result.error) { setError(translateActionError(result.error)); return }
      setPromoteTarget(null)
      setError(null)
      router.refresh()
    })
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* INVITER */}
      <section aria-labelledby="invite-heading">
        <h2
          id="invite-heading"
          className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary-text"
        >
          {t('admin.inviteSection')}
        </h2>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          {/* Code court */}
          <div className="flex flex-col gap-1">
            <span className="text-2xs text-text-muted">{t('admin.shortCode')}</span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-numeric text-2xl font-bold tracking-widest text-foreground">
                {inviteCode}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={copyCode}
                className="shrink-0"
              >
                {codeCopied ? '✓' : t('admin.copyCode')}
              </Button>
            </div>
          </div>

          {/* Lien complet */}
          <div className="flex flex-col gap-2">
            <span className="text-2xs text-text-muted">{t('admin.fullLink')}</span>
            <p className="truncate font-mono text-xs text-text-secondary">{fullUrl}</p>
            <div className="flex gap-2">
              <Button
                variant="accent"
                size="sm"
                onClick={copyLink}
                className="flex-1"
              >
                {linkCopied ? '✓' : t('admin.copyLink')}
              </Button>
              {regenConfirm ? (
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-2xs text-text-secondary">{t('admin.regenWarning')}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRegenConfirm(false)}
                      className="flex-1"
                    >
                      {t('admin.cancel')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegen}
                      disabled={isPendingRegen}
                      className="flex-1 border-destructive text-destructive hover:bg-destructive-soft"
                    >
                      {isPendingRegen ? '…' : t('admin.confirm')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRegenConfirm(true)}
                  className="flex-1"
                >
                  {t('admin.regen')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Inscriptions */}
      <section>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {t('admin.inscriptionsLabel')}
            </span>
            <span className={cn('text-xs font-medium', open ? 'text-success' : 'text-text-muted')}>
              {open ? t('admin.inscriptionsOpen') : t('admin.inscriptionsClosed')}
            </span>
          </div>
          {/* Toggle visuel */}
          <button
            type="button"
            role="switch"
            aria-checked={open}
            aria-label={t('admin.inscriptionsLabel')}
            onClick={handleToggle}
            disabled={isPendingToggle}
            className={cn(
              'relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
              open ? 'bg-success' : 'bg-secondary',
            )}
          >
            <span
              className={cn(
                'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                open ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </button>
        </div>
      </section>

      {/* Membres · Transfert d'admin */}
      <section aria-labelledby="members-heading">
        <h2
          id="members-heading"
          className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary-text"
        >
          {t('admin.membersSection')}
        </h2>

        <div className="flex flex-col gap-1.5">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId
            const isPromoting = promoteTarget === member.userId

            return (
              <div key={member.userId} className="flex flex-col gap-2">
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5',
                    isCurrentUser ? 'bg-accent-soft' : 'bg-card',
                  )}
                >
                  <UserAvatar
                    avatarKey={member.avatarKey}
                    avatarUrl={member.avatarUrl}
                    size={32}
                    label={member.pseudo}
                  />
                  <span className="flex-1 text-sm font-semibold text-foreground">
                    {member.pseudo}
                  </span>
                  {member.isAdmin ? (
                    <Badge variant="gold">{t('leagues.adminBadge')}</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPromoteTarget(isPromoting ? null : member.userId)}
                    >
                      {t('admin.promoteAdmin')}
                    </Button>
                  )}
                </div>

                {/* Confirmation inline de transfert */}
                {isPromoting && (
                  <div className="ml-11 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-xs text-text-secondary">{t('admin.promoteWarning')}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPromoteTarget(null)}
                        className="flex-1"
                      >
                        {t('admin.cancel')}
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => handleTransfer(member.userId)}
                        disabled={isPendingTransfer}
                        className="flex-1"
                      >
                        {isPendingTransfer ? '…' : t('admin.confirm')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Disclaimer */}
      <p className="text-center text-2xs text-text-muted px-2">
        {t('admin.disclaimer')}
      </p>
    </div>
  )
}
