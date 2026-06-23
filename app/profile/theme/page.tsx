'use client'

import Link from 'next/link'
import { ChevronLeft, Check } from 'lucide-react'
import { THEMES, useTheme } from '@/lib/hooks/use-theme'
import { t } from '@/lib/i18n'

export default function ThemePage() {
  const [activeTheme, setTheme] = useTheme()

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('profile.back')}
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground">
          {t('theme.pageTitle')}
        </h1>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{t('theme.subtitle')}</p>

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {THEMES.map((theme) => {
          const isActive = theme.id === activeTheme
          return (
            <li key={theme.id}>
              <button
                type="button"
                onClick={() => setTheme(theme.id)}
                aria-pressed={isActive}
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 active:bg-muted"
              >
                {/* Swatch couleur officielle */}
                <span
                  className="h-9 w-9 shrink-0 rounded-xl border-2 border-white/10"
                  style={{ backgroundColor: theme.primary }}
                  aria-hidden
                />
                <span className="flex-1 text-sm font-medium text-foreground">
                  {t(`theme.themes.${theme.id}`)}
                </span>
                {isActive && (
                  <Check
                    size={18}
                    className="shrink-0 text-primary"
                    aria-label={t('theme.applied')}
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
