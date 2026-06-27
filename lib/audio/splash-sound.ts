'use client'

import { useEffect, useState } from 'react'

/**
 * Préférence « Son du splash » — calquée sur le pattern reduce-motion
 * (cf. lib/hooks/use-prefers-reduced-motion.ts) : clé localStorage, point
 * d'entrée unique d'écriture, et event interne pour notifier le même onglet.
 *
 * Décision produit : le son est **activé par défaut** (opt-out), désactivable
 * depuis le profil. À noter : au tout premier lancement à froid le navigateur
 * suspend l'AudioContext faute de geste utilisateur, donc le son est de fait
 * muet à ce moment-là quelle que soit la préférence (dégradation silencieuse).
 */

/** Clé localStorage du toggle « Son du splash ». */
export const SPLASH_SOUND_STORAGE_KEY = 'splash-sound-enabled'

/** Event interne (même onglet) — l'event `storage` natif ne traverse qu'entre onglets. */
const SPLASH_SOUND_EVENT = 'splash-sound-change'

/** `true` si le son est actif. Absence de clé = défaut activé (opt-out). */
export function getSplashSoundEnabled(): boolean {
  return localStorage.getItem(SPLASH_SOUND_STORAGE_KEY) !== 'false'
}

/** Persiste la préférence et notifie les composants du même onglet. */
export function setSplashSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SPLASH_SOUND_STORAGE_KEY, String(enabled))
  window.dispatchEvent(new Event(SPLASH_SOUND_EVENT))
}

/**
 * `true` si le son du splash est activé. Réactif aux changements (même onglet
 * via `splash-sound-change`, autres onglets via `storage`).
 */
export function useSplashSoundEnabled(): boolean {
  // Défaut `true` côté SSR/premier rendu pour refléter l'opt-out ; resynchronisé
  // au montage avec la valeur réelle du localStorage.
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const sync = () => setEnabled(getSplashSoundEnabled())

    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(SPLASH_SOUND_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(SPLASH_SOUND_EVENT, sync)
    }
  }, [])

  return enabled
}
