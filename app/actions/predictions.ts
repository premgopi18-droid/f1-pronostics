'use server'

import { createClient } from '@/lib/supabase'
import { submitPrediction, submitFastestLap } from '@/lib/data/predictions'
import { POSITIONS_TO_SCORE } from '@/lib/scoring/constants'
import type { SessionType } from '@/lib/scoring/types'

export type PredictionActionResult = { error: string } | { ok: true }

export async function submitPredictionAction(
  sessionId: string,
  entries:   string[],
): Promise<PredictionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Type et saison dérivés de la session (jamais du client)
  const { data: session } = await supabase
    .from('sessions')
    .select('starts_at, type, season')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session introuvable' }
  if (new Date(session.starts_at) <= new Date()) return { error: 'Session verrouillée' }

  const sessionType = session.type as SessionType
  const season      = session.season
  const expected    = POSITIONS_TO_SCORE[sessionType]

  // Validation du contenu : longueur, doublons, codes pilotes connus pour la saison
  if (entries.length > expected) return { error: 'Trop de pilotes sélectionnés' }
  if (new Set(entries).size !== entries.length) return { error: 'Un pilote apparaît en double' }

  const { data: drivers } = await supabase
    .from('drivers')
    .select('code')
    .eq('season', season)
  const validCodes = new Set((drivers ?? []).map((d) => d.code))
  if (!entries.every((code) => validCodes.has(code))) {
    return { error: 'Sélection invalide (pilote inconnu)' }
  }

  try {
    await submitPrediction(user.id, sessionId, season, sessionType, entries)
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }
}

export async function submitFastestLapAction(
  sessionId: string,
  driverId:  string,
): Promise<PredictionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: session } = await supabase
    .from('sessions')
    .select('starts_at, type, season')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session introuvable' }
  if (session.type !== 'race') return { error: 'Meilleur tour réservé à la course' }
  if (new Date(session.starts_at) <= new Date()) return { error: 'Session verrouillée' }

  try {
    await submitFastestLap(user.id, sessionId, session.season, driverId)
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }
}
