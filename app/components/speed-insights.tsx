'use client'

import type { ComponentProps } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Le paquet n'exporte pas ses types d'événement : on les dérive des props du composant.
type BeforeSend = NonNullable<ComponentProps<typeof SpeedInsights>['beforeSend']>
type BeforeSendEvent = Parameters<BeforeSend>[0]

/**
 * Télémétrie perf terrain (#244) — Vercel Speed Insights, tier gratuit.
 *
 * Le SDK envoie `location.href` complet : la query string des pages remonterait
 * (ex. le code d'invitation de `/leagues/join?code=…`), exactement ce que la
 * `Referrer-Policy` de next.config.ts cherche à ne pas exposer. On la tronque avant
 * envoi. Wrapper client : une fonction ne passe pas la frontière RSC depuis le layout.
 */
function stripQueryString(event: BeforeSendEvent): BeforeSendEvent {
  const queryStart = event.url.indexOf('?')
  return queryStart === -1 ? event : { ...event, url: event.url.slice(0, queryStart) }
}

export function SpeedInsightsTelemetry() {
  return <SpeedInsights beforeSend={stripQueryString} />
}
