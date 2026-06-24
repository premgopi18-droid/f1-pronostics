'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    // Event beforeinstallprompt capté avant l'hydratation par le boot script du layout
    // (cf. installPromptBootScript dans app/layout.tsx).
    __deferredInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

const DISMISSED_KEY = 'install-banner-dismissed'

// Safari iOS uniquement : les autres navigateurs iOS (Chrome/Firefox/in-app) n'exposent
// pas l'option « Sur l'écran d'accueil » → inutile (et trompeur) de leur montrer la consigne.
function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  const isIOSDevice =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ se présente comme « Macintosh » : on le distingue via le tactile.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIOSDevice && !isOtherIOSBrowser
}

export function useInstallPrompt() {
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS]               = useState(false)
  const [isStandalone, setIsStandalone]  = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(true)
  const [ready, setReady]               = useState(false)

  useEffect(() => {
    // Lecture des capacités navigateur au montage (et pas à l'init, pour éviter un
    // mismatch d'hydratation). Encapsulé dans une fonction : react-hooks proscrit un
    // setState synchrone direct dans le corps d'un effet (cf. usePrefersReducedMotion).
    function detect() {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      setIsStandalone(standalone)
      setBannerDismissed(localStorage.getItem(DISMISSED_KEY) === 'true')
      setIsIOS(isIOSSafari())
      setReady(true)
      // Event éventuellement déclenché avant le montage et capté par le boot script.
      if (window.__deferredInstallPrompt) setAndroidPrompt(window.__deferredInstallPrompt)
    }
    detect()

    function onPrompt(e: Event) {
      e.preventDefault()
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Installable « automatiquement » = pas standalone ET (prompt Android dispo OU iOS Safari).
  // Sert à la bannière, volontairement réservée aux cas réellement actionnables.
  const canInstall = ready && !isStandalone && (androidPrompt !== null || isIOS)

  // Bannière = installable ET pas encore fermée par l'utilisateur
  const showBanner = canInstall && !bannerDismissed

  // Prompt natif Android effectivement capté → on peut déclencher l'installation.
  const canPromptInstall = androidPrompt !== null

  // Entrée dans les réglages = visible dès que l'app n'est pas déjà installée, quelle que
  // soit la plateforme. La guidance s'adapte (bouton natif, instructions iOS, ou menu du
  // navigateur) — voir ProfileSettings. Indépendant du dismiss de la bannière.
  const showInSettings = ready && !isStandalone

  function dismissBanner() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setBannerDismissed(true)
  }

  async function install() {
    if (!androidPrompt) return
    try {
      await androidPrompt.prompt()
      const { outcome } = await androidPrompt.userChoice
      if (outcome === 'accepted') setIsStandalone(true)
      else dismissBanner()
    } finally {
      // L'event beforeinstallprompt est à usage unique : un 2e prompt() rejette
      // (InvalidStateError). On le consomme pour éviter tout réappel (ex. depuis les réglages).
      window.__deferredInstallPrompt = null
      setAndroidPrompt(null)
    }
  }

  return { isIOS, showBanner, showInSettings, canPromptInstall, install, dismissBanner }
}