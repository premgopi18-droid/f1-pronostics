'use client'

import Link from 'next/link'
import { ChevronRight, Pencil, Palette, Paintbrush, Bell, Accessibility, Smartphone, Share } from 'lucide-react'
import {
  usePrefersReducedMotion,
  setReduceMotionOverride,
} from '@/lib/hooks/use-prefers-reduced-motion'
import { useInstallPrompt } from '@/lib/hooks/use-install-prompt'
import { t } from '@/lib/i18n'

export function ProfileSettings() {
  // usePrefersReducedMotion se souscrit aux changements système et à l'override utilisateur.
  const reducedMotion = usePrefersReducedMotion()
  const { isIOS, showInSettings, install } = useInstallPrompt()

  function toggleAccessibility() {
    setReduceMotionOverride(!reducedMotion)
  }

  return (
    <nav aria-label={t('profile.pageTitle')}>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-card">
        <li>
          <Link
            href="/profile/edit-pseudo"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <Pencil size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-sm font-medium text-foreground">
              {t('profile.editPseudo')}
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>

        <li>
          <Link
            href="/profile/edit-avatar"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <Palette size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-sm font-medium text-foreground">
              {t('profile.editAvatar')}
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>

        <li>
          <Link
            href="/profile/theme"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <Paintbrush size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-sm font-medium text-foreground">
              {t('profile.theme')}
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>

        <li>
          <Link
            href="/profile/notifications"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <Bell size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-sm font-medium text-foreground">
              {t('profile.notifications')}
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>

        {showInSettings && (
          <li>
            {isIOS ? (
              <div className="flex items-start gap-3 px-4 py-4">
                <Smartphone size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{t('install.profileRow')}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('install.iosInstructions')}{' '}
                    <Share size={11} aria-hidden className="inline" />{' '}
                    {t('install.iosThen')}
                  </span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={install}
                className="flex w-full items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <Smartphone size={18} className="shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-left text-sm font-medium text-foreground">
                  {t('install.profileRow')}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )}
          </li>
        )}

        <li>
          <button
            type="button"
            onClick={toggleAccessibility}
            className="flex w-full items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
            aria-pressed={reducedMotion}
          >
            <Accessibility size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-left text-sm font-medium text-foreground">
              {t('profile.accessibility')}
            </span>
            {/* Toggle pill */}
            <span
              className={[
                'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                reducedMotion ? 'bg-primary' : 'bg-muted',
              ].join(' ')}
              aria-hidden
            >
              <span
                className={[
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
                  reducedMotion ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
