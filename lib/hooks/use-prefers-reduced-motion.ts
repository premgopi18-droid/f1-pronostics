'use client'

import { useState, useEffect } from 'react'
// Constantes dans un module non-`'use client'` (cf. lib/a11y/reduce-motion.ts) pour
// rester lisibles depuis le layout serveur. Importer les constantes directement de là,
// pas via ce hook : passer par un module `'use client'` côté serveur les transforme en
// références client (sérialisées en `undefined`).
import { REDUCE_MOTION_STORAGE_KEY, REDUCE_MOTION_CLASS } from '@/lib/a11y/reduce-motion'

/** Event interne pour notifier les composants du même onglet (l'event `storage`
 *  natif ne se déclenche qu'entre onglets). */
const REDUCE_MOTION_EVENT = 'reduce-motion-change'

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
 * Persiste l'override, applique la classe, et notifie les composants du même onglet.
 * Point d'entrée unique pour modifier le mode accessibilité manuel.
 */
export function setReduceMotionOverride(enabled: boolean): void {
  localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(enabled))
  applyReduceMotion(enabled)
  window.dispatchEvent(new Event(REDUCE_MOTION_EVENT))
}

/**
 * `true` si les animations doivent être réduites. Réactif aux changements de la
 * préférence système et de l'override (même onglet via `reduce-motion-change`,
 * autres onglets via `storage`).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Re-applique la classe en plus de l'état React : sur un event `storage` (override
    // changé dans un autre onglet), le DOM de cet onglet doit suivre, pas seulement le
    // toggle. En same-tab c'est idempotent (déjà posée par setReduceMotionOverride).
    const sync = () => {
      const next = resolveReducedMotion()
      setReduced(next)
      applyReduceMotion(next)
    }

    sync()
    mq.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    window.addEventListener(REDUCE_MOTION_EVENT, sync)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener(REDUCE_MOTION_EVENT, sync)
    }
  }, [])

  return reduced
}
