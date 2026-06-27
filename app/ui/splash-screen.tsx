'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { resolveReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion'
import { getSplashSoundEnabled } from '@/lib/audio/splash-sound'
import { playEngineFlyby } from '@/lib/audio/engine-flyby'

// Lottie s'appuie sur lottie-web, qui touche `document`/`window` → chargé côté
// client uniquement (jamais rendu au SSR).
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

/** Marqueur sessionStorage : le splash ne se joue qu'une fois par session d'onglet. */
const SPLASH_SESSION_KEY = 'splash-shown'
/** Lottie servi statiquement (cf. public/animations/splash.json), fetché au runtime
 *  pour ne pas gonfler le bundle JS. */
const LOTTIE_PATH = '/animations/splash.json'

// Synchro du son sur la traversée de la voiture, repris des timings du proto
// (`--start-delay` / `--car-duration` dans docs/design/boxbox-splash.html).
const SOUND_START_DELAY_SECONDS = 0.3
const SOUND_DURATION_SECONDS = 2.6

/** Durée du fondu de sortie une fois l'animation terminée. */
const FADE_DURATION_MS = 500
/** Filet de sécurité : si le Lottie échoue à charger/jouer, `onComplete` ne se
 *  déclenche jamais — on force la disparition pour ne pas masquer l'app.
 *  Animation = 3.2 s, on laisse une marge confortable. */
const SAFETY_TIMEOUT_MS = 5000

type SplashPhase = 'idle' | 'playing' | 'fading' | 'gone'

/**
 * Splash in-app joué au lancement : animation Lottie + son moteur F1 optionnel.
 * Skippé si « mode réduit » (système ou override) et rejoué une seule fois par
 * session (la navigation client ne remonte pas le layout, mais un reload oui →
 * sessionStorage, pas un simple state).
 */
export function SplashScreen() {
  // Démarre en `idle` (rendu serveur = rien) ; la décision se prend au montage
  // client pour éviter tout mismatch d'hydratation autour de sessionStorage.
  const [phase, setPhase] = useState<SplashPhase>('idle')
  const [animationData, setAnimationData] = useState<unknown>(null)

  useEffect(() => {
    if (resolveReducedMotion()) return
    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) return

    if (getSplashSoundEnabled()) {
      // Best-effort : muet si le navigateur garde l'AudioContext suspendu
      // (pas de geste utilisateur au lancement à froid) — volontairement non bloquant.
      playEngineFlyby(SOUND_START_DELAY_SECONDS, SOUND_DURATION_SECONDS)
    }

    let cancelled = false
    // L'overlay n'apparaît (`playing`) qu'une fois le JSON prêt : la transition
    // d'état part d'un callback async, pas du corps de l'effet (évite les rendus
    // en cascade). Le JSON est local → chargement quasi-instantané.
    fetch(LOTTIE_PATH)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        // On ne marque la session « vue » qu'au moment où le splash s'affiche
        // vraiment : un échec de fetch laissera donc un retry au prochain reload.
        sessionStorage.setItem(SPLASH_SESSION_KEY, '1')
        setAnimationData(data)
        setPhase('playing')
      })
      .catch(() => {
        // Échec de chargement : on ne masque jamais l'app (phase reste `idle`).
      })

    // Filet de sécurité : si `onComplete` ne se déclenche jamais alors que
    // l'animation est affichée, on force la sortie pour ne pas masquer l'app.
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setPhase((current) => (current === 'playing' ? 'fading' : current))
    }, SAFETY_TIMEOUT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(safetyTimer)
    }
  }, [])

  if (phase === 'idle' || phase === 'gone') return null

  return (
    <div
      // Brand black plein écran, au-dessus de tout (nav + bannières en z-50).
      className={[
        'fixed inset-0 z-[100] flex items-center justify-center bg-black',
        'transition-opacity ease-out',
        phase === 'fading' ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
      // Garde anti-bubbling : ne réagir qu'au fondu de l'overlay lui-même, pas à
      // une éventuelle transition d'un descendant (qui couperait le fondu court).
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) {
          setPhase((current) => (current === 'fading' ? 'gone' : current))
        }
      }}
      role="presentation"
      aria-hidden
    >
      {animationData !== null && (
        <Lottie
          animationData={animationData}
          loop={false}
          onComplete={() => setPhase('fading')}
          className="h-full w-full"
        />
      )}
    </div>
  )
}
