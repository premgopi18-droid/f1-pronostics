// Constantes du splash partagées serveur ⇄ client. NE PAS ajouter 'use client'
// ici : le boot script anti-flash du layout (Server Component) interpole ces
// valeurs dans une string ; venant d'un module 'use client', le serveur n'en
// recevrait que des références client (sérialisées en `undefined`).
// Même contrainte que lib/a11y/reduce-motion.ts.

/** Clé sessionStorage : le splash ne se joue qu'une fois par session d'onglet. */
export const SPLASH_SESSION_STORAGE_KEY = 'splash-shown'

/** Classe posée sur `<html>` par le boot script quand le splash doit jouer.
 *  Rend l'overlay (sinon masqué) visible avant le 1er paint — cf. globals.css. */
export const SPLASH_PLAY_CLASS = 'splash-play'

/** Fond de l'overlay, **partagé avec le `background_color` du manifest** pour que
 *  le splash système (icône sur fond, rendu par l'OS avant notre code) se fonde
 *  sans cassure de couleur dans l'animation in-app. */
export const SPLASH_BACKGROUND_COLOR = '#0f0f0f'

/** Filet de sécurité côté boot script : si React ne retire jamais l'overlay
 *  (bundle qui ne charge pas), on le masque après ce délai pour ne pas bloquer
 *  l'app. Doit dépasser la durée animation (3.2 s) + fondu. */
export const SPLASH_FAILSAFE_MS = 6000
