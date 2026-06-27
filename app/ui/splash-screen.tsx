'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { getSplashSoundEnabled } from '@/lib/audio/splash-sound'
import { playEngineFlyby } from '@/lib/audio/engine-flyby'
import { SPLASH_PLAY_CLASS, SPLASH_BACKGROUND_COLOR } from '@/lib/splash/splash'

// Lottie s'appuie sur lottie-web, qui touche `document`/`window` → chargé côté
// client uniquement (jamais rendu au SSR).
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

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
 *  déclenche jamais — on force le fondu pour ne pas masquer l'app indéfiniment.
 *  (Doublé par le filet du boot script, au cas où React lui-même ne tournerait pas.) */
const SAFETY_TIMEOUT_MS = 5000

/**
 * Splash in-app joué au lancement : animation Lottie + son moteur F1 optionnel.
 *
 * L'overlay est rendu en SSR (présent dans le HTML) mais masqué par défaut ; le
 * boot script du layout pose `.splash-play` sur <html> AVANT le 1er paint quand
 * le splash doit jouer → l'écran est couvert immédiatement, sans flash de la
 * Home (et la décision skip / une-fois-par-session est déjà prise là-bas). Ce
 * composant ne fait que charger le Lottie, jouer le son, puis fondre et retirer
 * l'overlay à la fin.
 */
export function SplashScreen() {
  const [fading, setFading] = useState(false)
  const [gone, setGone] = useState(false)
  const [animationData, setAnimationData] = useState<unknown>(null)

  useEffect(() => {
    // Le boot script a déjà tranché : sans `.splash-play`, on ne joue rien
    // (l'overlay reste masqué par CSS).
    if (!document.documentElement.classList.contains(SPLASH_PLAY_CLASS)) return

    if (getSplashSoundEnabled()) {
      // Best-effort : muet si le navigateur garde l'AudioContext suspendu
      // (pas de geste utilisateur au lancement à froid) — volontairement non bloquant.
      playEngineFlyby(SOUND_START_DELAY_SECONDS, SOUND_DURATION_SECONDS)
    }

    let cancelled = false
    fetch(LOTTIE_PATH)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data)
      })
      .catch(() => {
        // Échec de chargement : le filet de sécurité enclenchera le fondu.
      })

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setFading(true)
    }, SAFETY_TIMEOUT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(safetyTimer)
    }
  }, [])

  if (gone) return null

  return (
    <div
      // `splash-overlay` : masqué par défaut, révélé par `.splash-play` (globals.css).
      // `items-center justify-center` s'appliquent une fois `display:flex` posé par cette classe.
      className={[
        'splash-overlay fixed inset-0 z-[100] items-center justify-center',
        'transition-opacity ease-out',
        fading ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      style={{ backgroundColor: SPLASH_BACKGROUND_COLOR, transitionDuration: `${FADE_DURATION_MS}ms` }}
      // Garde anti-bubbling + ne réagir qu'au fondu de l'overlay lui-même.
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && fading) {
          document.documentElement.classList.remove(SPLASH_PLAY_CLASS)
          setGone(true)
        }
      }}
      role="presentation"
      aria-hidden
    >
      {animationData !== null && (
        <Lottie
          animationData={animationData}
          loop={false}
          onComplete={() => setFading(true)}
          className="h-full w-full"
        />
      )}
    </div>
  )
}
