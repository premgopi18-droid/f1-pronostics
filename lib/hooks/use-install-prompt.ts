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
// Exporté pour test unitaire (logique de détection UA pure).
export function isIOSSafari(): boolean {
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
  const [supportsPrompt, setSupportsPrompt] = useState(false)
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
      // Moteur Chromium (Android/desktop) : seul à exposer l'install PWA via prompt/menu.
      // Firefox/Safari desktop ne l'ont pas → on n'affichera aucune consigne d'install.
      setSupportsPrompt('onbeforeinstallprompt' in window)
      setReady(true)
      // Event éventuellement déclenché avant le montage et capté par le boot script.
      if (window.__deferredInstallPrompt) setAndroidPrompt(window.__deferredInstallPrompt)
    }
    detect()

    function onPrompt(e: Event) {
      e.preventDefault()
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
    // Installation terminée (bouton natif OU menu du navigateur) → masque banner/CTA sans
    // attendre un rechargement. Diffusé à toutes les instances du hook. (iOS ne l'émet pas.)
    function onInstalled() {
      setIsStandalone(true)
      window.__deferredInstallPrompt = null
      setAndroidPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Installable « automatiquement » = pas standalone ET (prompt Android dispo OU iOS Safari).
  // Sert à la bannière, volontairement réservée aux cas réellement actionnables.
  const canInstall = ready && !isStandalone && (androidPrompt !== null || isIOS)

  // Bannière = installable ET pas encore fermée par l'utilisateur
  const showBanner = canInstall && !bannerDismissed

  // Prompt natif Android effectivement capté → on peut déclencher l'installation.
  const canPromptInstall = androidPrompt !== null

  // Entrée dans les réglages = visible tant que l'app n'est pas installée ET que le navigateur
  // sait installer une PWA (iOS Safari, ou moteur Chromium). Exclut Firefox/Safari desktop, qui
  // n'ont pas d'install PWA → pas de consigne trompeuse. La guidance s'adapte ensuite (bouton
  // natif, instructions iOS, ou menu du navigateur) — voir ProfileSettings.
  const showInSettings = ready && !isStandalone && (isIOS || supportsPrompt)

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