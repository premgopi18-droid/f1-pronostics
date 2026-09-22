'use client'

import type { ComponentProps } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { hasSplashPlayed } from '@/lib/splash/splash'

// Le paquet n'exporte pas ses types d'événement : on les dérive des props du composant.
type BeforeSend = NonNullable<ComponentProps<typeof SpeedInsights>['beforeSend']>
type BeforeSendEvent = Parameters<BeforeSend>[0]

/**
 * Télémétrie perf terrain (#244) — Vercel Speed Insights, tier gratuit.
 * Wrapper client : une fonction ne passe pas la frontière RSC depuis le layout.
 *
 * Deux filtres avant envoi :
 * - Chargements où le splash a joué (#251) : ignorés en bloc. Le navigateur ne compte
 *   le contenu comme affiché qu'une fois l'overlay retiré → FCP/LCP = durée Lottie +
 *   fondu (3,7 s mesurés), une animation voulue, pas une lenteur. L'événement ne porte
 *   pas le nom de la métrique, donc TTFB/INP/CLS de ce chargement partent aussi —
 *   assumé : le score doit refléter ce sur quoi on peut agir.
 * - Query string tronquée : le SDK envoie `location.href` complet, le code d'invitation
 *   de `/leagues/join?code=…` remonterait, exactement ce que la `Referrer-Policy` de
 *   next.config.ts cherche à ne pas exposer.
 */
function filterVitals(event: BeforeSendEvent): BeforeSendEvent | null {
  if (hasSplashPlayed(window as unknown as Record<string, unknown>)) return null
  const queryStart = event.url.indexOf('?')
  return queryStart === -1 ? event : { ...event, url: event.url.slice(0, queryStart) }
}

export function SpeedInsightsTelemetry() {
  return <SpeedInsights beforeSend={filterVitals} />
}
