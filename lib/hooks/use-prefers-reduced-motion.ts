'use client'

import { useState, useEffect } from 'react'

/** Clé localStorage de l'override « Mode accessibilité » posé depuis le profil. */
export const REDUCE_MOTION_STORAGE_KEY = 'reduce-motion-override'
/** Classe posée sur `<html>` qui coupe animations/transitions (cf. globals.css). */
export const REDUCE_MOTION_CLASS = 'reduce-motion'

/** Override explicite de l'utilisateur (`true`/`false`), ou `null` si non défini. */
export function getReduceMotionOverride(): boolean | null {
  const raw = localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)
  return raw === null ? null : raw === 'true'
}

/**
 * État effectif : `true` si la préférence système l'exige, OU si l'utilisateur a
 * activé le mode accessibilité manuel. L'override ne fait qu'ajouter de la réduction —
 * il ne peut pas désactiver le `prefers-reduced-motion` du système (toujours respecté,
 * cf. la media query dans globals.css). Source unique partagée par le hook, le toggle
 * profil et le script anti-FOUC du layout.
 */
export function resolveReducedMotion(): boolean {
  const system = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return getReduceMotionOverride() === true || system
}

/** Applique/retire la classe globale selon l'état voulu. */
export function applyReduceMotion(enabled: boolean): void {
  document.documentElement.classList.toggle(REDUCE_MOTION_CLASS, enabled)
}

/**
 * `true` si les animations doivent être réduites. Réactif aux changements de la
 * préférence système et de l'override (synchronisé entre onglets via `storage`).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(resolveReducedMotion())

    sync()
    mq.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return reduced
}
