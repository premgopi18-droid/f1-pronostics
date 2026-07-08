'use server'

import { createClient } from '@/lib/supabase'
import type { ActionFailure } from '@/lib/actions/errors'
import { submitPrediction, submitFastestLap } from '@/lib/data/predictions'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import type { SessionType } from '@/lib/scoring/types'

export type PredictionActionResult = ActionFailure | { ok: true }

export async function submitPredictionAction(
  sessionId: string,
  entries:   string[],
): Promise<PredictionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'notAuthenticated' }

  // Type et saison dérivés de la session (jamais du client)
  const { data: session } = await supabase
    .from('sessions')
    .select('starts_at, type, season')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'sessionNotFound' }
  if (new Date(session.starts_at) <= new Date()) return { error: 'sessionLocked' }

  const sessionType = session.type as SessionType
  const season      = session.season
  const expected    = POSITIONS_TO_SCORE[sessionType]

  // Validation du contenu : longueur, doublons, codes pilotes connus pour la saison
  if (entries.length > expected) return { error: 'tooManyDrivers' }
  if (new Set(entries).size !== entries.length) return { error: 'duplicateDriver' }

  const { data: drivers } = await supabase
    .from('drivers')
    .select('code')
    .eq('season', season)
  const validCodes = new Set((drivers ?? []).map((d) => d.code))
  if (!entries.every((code) => validCodes.has(code))) {
    return { error: 'unknownDriver' }
  }

  try {
    await submitPrediction(user.id, sessionId, season, sessionType, entries)
    return { ok: true }
  } catch (error) {
    // Le détail technique va dans les logs serveur, jamais dans l'UI.
    console.error('[actions/predictions] submitPrediction', error)
    return { error: 'unexpected' }
  }
}

export async function submitFastestLapAction(
  sessionId: string,
  driverId:  string,
): Promise<PredictionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'notAuthenticated' }

  const { data: session } = await supabase
    .from('sessions')
    .select('starts_at, type, season')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'sessionNotFound' }
  if (session.type !== 'race') return { error: 'fastestLapRaceOnly' }
  if (new Date(session.starts_at) <= new Date()) return { error: 'sessionLocked' }

  try {
    await submitFastestLap(user.id, sessionId, session.season, driverId)
    return { ok: true }
  } catch (error) {
    // Le détail technique va dans les logs serveur, jamais dans l'UI.
    console.error('[actions/predictions] submitFastestLap', error)
    return { error: 'unexpected' }
  }
}
