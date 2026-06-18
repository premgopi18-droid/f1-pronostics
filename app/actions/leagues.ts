'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { createLeague, joinLeagueByCode } from '@/lib/data/leagues'
import { getCurrentSeason } from '@/lib/api/cron'

export type LeagueActionState = { error: string } | null

export async function createLeagueAction(
  _prevState: LeagueActionState,
  formData:   FormData,
): Promise<LeagueActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const name       = (formData.get('name') as string | null)?.trim() ?? ''
  const maxMembers = parseInt(formData.get('maxMembers') as string, 10)

  if (name.length < 2 || name.length > 50) return { error: 'Nom invalide (2–50 caractères)' }
  if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 20) return { error: 'Taille invalide (2–20 joueurs)' }

  let leagueId: string
  try {
    const result = await createLeague(user.id, name, maxMembers, getCurrentSeason())
    leagueId = result.leagueId
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }

  // redirect() lance une exception NEXT_REDIRECT → doit rester hors du try/catch
  redirect(`/leagues/${leagueId}`)
}

export async function joinLeagueAction(
  _prevState: LeagueActionState,
  formData:   FormData,
): Promise<LeagueActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const inviteCode = (formData.get('inviteCode') as string | null)?.trim().toUpperCase() ?? ''
  if (!inviteCode) return { error: 'Code d\'invitation requis' }

  let leagueId: string
  try {
    const result = await joinLeagueByCode(user.id, inviteCode, getCurrentSeason())
    leagueId = result.leagueId
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur inattendue' }
  }

  redirect(`/leagues/${leagueId}`)
}
