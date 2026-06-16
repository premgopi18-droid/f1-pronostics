'use server'

import { createClient } from '@/lib/supabase'
import { submitPrediction, submitFastestLap } from '@/lib/data/predictions'
import type { SessionType } from '@/lib/scoring/types'

export type PredictionActionResult = { error: string } | { ok: true }

export async function submitPredictionAction(
  sessionId:   string,
  sessionType: SessionType,
  season:      number,
  entries:     string[],
): Promise<PredictionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifie que la session n'est pas encore verrouillée
  const { data: session } = await supabase
    .from('sessions')
    .select('starts_at')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session introuvable' }
  if (new Date(session.starts_at as string) <= new Date()) return { error: 'Session verrouillée' }

  try {
    await submitPrediction(user.id, sessionId, season, sessionType, entries)
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }
}

export async function submitFastestLapAction(
  sessionId: string,
  season:    number,
  driverId:  string,
): Promise<PredictionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: session } = await supabase
    .from('sessions')
    .select('starts_at')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: 'Session introuvable' }
  if (new Date(session.starts_at as string) <= new Date()) return { error: 'Session verrouillée' }

  try {
    await submitFastestLap(user.id, sessionId, season, driverId)
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }
}
