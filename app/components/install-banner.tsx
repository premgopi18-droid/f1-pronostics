'use client'

import { Share, X } from 'lucide-react'
import Image from 'next/image'
import { useInstallPrompt } from '@/lib/hooks/use-install-prompt'
import { t } from '@/lib/i18n'

export function InstallBanner() {
  const { isIOS, showBanner, install, dismissBanner } = useInstallPrompt()

  if (!showBanner) return null

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="shrink-0 rounded-xl"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t('install.bannerTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {isIOS
              ? <span className="flex flex-wrap items-center gap-x-1">
                  {t('install.iosInstructions')}
                  <Share size={11} aria-hidden className="inline shrink-0" />
                  {t('install.iosThen')}
                </span>
              : t('install.bannerSubtitle')
            }
          </p>
        </div>

        {!isIOS && (
          <button
            onClick={install}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 active:scale-95"
          >
            {t('install.ctaAndroid')}
          </button>
        )}

        <button
          onClick={dismissBanner}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
          aria-label={t('install.close')}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}