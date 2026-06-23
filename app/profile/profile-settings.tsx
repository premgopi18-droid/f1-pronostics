'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Pencil, Palette, Bell, Accessibility } from 'lucide-react'
import { t } from '@/lib/i18n'

const ACCESSIBILITY_STORAGE_KEY = 'reduce-motion-override'

export function ProfileSettings() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) === 'true')
  }, [])

  function toggleAccessibility() {
    const next = !reducedMotion
    setReducedMotion(next)
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, String(next))
    document.documentElement.classList.toggle('reduce-motion', next)
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
