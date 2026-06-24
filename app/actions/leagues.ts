'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { createLeague, joinLeagueByCode, LeagueDataError } from '@/lib/data/leagues'
import { getCurrentSeason } from '@/lib/api/cron'

export type LeagueActionState = { errorCode: string } | null

export async function createLeagueAction(
  _prevState: LeagueActionState,
  formData:   FormData,
): Promise<LeagueActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { errorCode: 'unauthenticated' }

  const name       = (formData.get('name') as string | null)?.trim() ?? ''
  const maxMembers = parseInt(formData.get('maxMembers') as string, 10)

  if (name.length < 2 || name.length > 50) return { errorCode: 'invalid_name' }
  if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 20) return { errorCode: 'invalid_size' }

  let leagueId: string
  try {
    const result = await createLeague(user.id, name, maxMembers, getCurrentSeason())
    leagueId = result.leagueId
  } catch {
    return { errorCode: 'generic' }
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
  if (!user) return { errorCode: 'unauthenticated' }

  const inviteCode = (formData.get('inviteCode') as string | null)?.trim().toUpperCase() ?? ''
  if (!inviteCode) return { errorCode: 'invite_code_required' }

  let leagueId: string
  try {
    const result = await joinLeagueByCode(user.id, inviteCode, getCurrentSeason())
    leagueId = result.leagueId
  } catch (error) {
    return { errorCode: error instanceof LeagueDataError ? error.code : 'generic' }
  }

  redirect(`/leagues/${leagueId}`)
}
