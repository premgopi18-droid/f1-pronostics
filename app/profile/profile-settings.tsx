'use client'

import Link from 'next/link'
import { ChevronRight, Pencil, Palette, Paintbrush, Bell, Accessibility, Volume2, Smartphone, Share, Type } from 'lucide-react'
import {
  usePrefersReducedMotion,
  setReduceMotionOverride,
} from '@/lib/hooks/use-prefers-reduced-motion'
import { useSplashSoundEnabled, setSplashSoundEnabled } from '@/lib/audio/splash-sound'
import { ensureAudioContext } from '@/lib/audio/engine-flyby'
import { useInstallPrompt } from '@/lib/hooks/use-install-prompt'
import { useFontSize, setFontSizeOption } from '@/lib/hooks/use-font-size'
import { FONT_SIZE_OPTIONS, type FontSizeOption } from '@/lib/a11y/font-size'
import { t } from '@/lib/i18n'

const FONT_SIZE_LABELS: Record<FontSizeOption, string> = {
  normal: t('profile.fontSizeNormal'),
  large:  t('profile.fontSizeLarge'),
  xlarge: t('profile.fontSizeXlarge'),
}

export function ProfileSettings() {
  // usePrefersReducedMotion se souscrit aux changements système et à l'override utilisateur.
  const reducedMotion = usePrefersReducedMotion()
  const fontSizeOption = useFontSize()
  const { isIOS, showInSettings, canPromptInstall, install } = useInstallPrompt()
  const splashSoundEnabled = useSplashSoundEnabled()

  function toggleAccessibility() {
    setReduceMotionOverride(!reducedMotion)
  }

  function toggleSplashSound() {
    const next = !splashSoundEnabled
    setSplashSoundEnabled(next)
    // Le tap est un geste utilisateur : on en profite pour débloquer l'AudioContext
    // afin que le prochain splash ait du son (le lancement à froid, lui, reste muet).
    if (next) ensureAudioContext()
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
            {canPromptInstall ? (
              // Android avec prompt natif capté : installation en un tap.
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
            ) : isIOS ? (
              // iOS Safari : pas de prompt programmatique → consigne Partager.
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
              // Desktop ou Android sans prompt encore capté : renvoi vers le menu navigateur.
              <div className="flex items-start gap-3 px-4 py-4">
                <Smartphone size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{t('install.profileRow')}</span>
                  <span className="text-xs text-muted-foreground">{t('install.browserInstructions')}</span>
                </span>
              </div>
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

        <li>
          <div className="flex items-start gap-3 px-4 py-4">
            <Type size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                {t('profile.fontSize')}
              </span>
              <div role="group" aria-label={t('profile.fontSize')} className="flex gap-1.5">
                {FONT_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFontSizeOption(option)}
                    aria-pressed={fontSizeOption === option}
                    className={[
                      'rounded-lg px-3 py-1 text-xs font-medium transition-colors min-h-[44px] flex items-center',
                      fontSizeOption === option
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    ].join(' ')}
                  >
                    {FONT_SIZE_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </li>

        <li>
          <button
            type="button"
            onClick={toggleSplashSound}
            className="flex w-full items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 active:bg-muted"
            aria-pressed={splashSoundEnabled}
          >
            <Volume2 size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-left text-sm font-medium text-foreground">
              {t('profile.splashSound')}
            </span>
            {/* Toggle pill */}
            <span
              className={[
                'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                splashSoundEnabled ? 'bg-primary' : 'bg-muted',
              ].join(' ')}
              aria-hidden
            >
              <span
                className={[
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
                  splashSoundEnabled ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
