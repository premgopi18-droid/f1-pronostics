'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'install-banner-dismissed'

export function useInstallPrompt() {
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS]               = useState(false)
  const [isStandalone, setIsStandalone]  = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(true)
  const [ready, setReady]               = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)
    setBannerDismissed(localStorage.getItem(DISMISSED_KEY) === 'true')
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
    setReady(true)

    function onPrompt(e: Event) {
      e.preventDefault()
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Installable = pas standalone ET (prompt Android disponible OU iOS Safari)
  const canInstall = ready && !isStandalone && (androidPrompt !== null || isIOS)

  // Bannière = installable ET pas encore fermée par l'utilisateur
  const showBanner = canInstall && !bannerDismissed

  // Entrée dans les réglages = installable, indépendamment du dismiss de la bannière
  const showInSettings = canInstall

  function dismissBanner() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setBannerDismissed(true)
  }

  async function install() {
    if (!androidPrompt) return
    await androidPrompt.prompt()
    const { outcome } = await androidPrompt.userChoice
    if (outcome === 'accepted') setIsStandalone(true)
    else dismissBanner()
  }

  return { isIOS, showBanner, showInSettings, install, dismissBanner }
}