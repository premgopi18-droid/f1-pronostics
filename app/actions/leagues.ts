'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { createLeague, joinLeagueByCode, LeagueDataError, type JoinLeagueErrorCode } from '@/lib/data/leagues'
import { getCurrentSeason } from '@/lib/api/cron'

export type LeagueActionState<Code extends string = string> = { errorCode: Code } | null

type CreateErrorCode = 'unauthenticated' | 'invalid_name' | 'invalid_size' | 'generic'
type JoinErrorCode = JoinLeagueErrorCode | 'unauthenticated' | 'invite_code_required'

export async function createLeagueAction(
  _prevState: LeagueActionState<CreateErrorCode>,
  formData:   FormData,
): Promise<LeagueActionState<CreateErrorCode>> {
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
  } catch (error) {
    console.error('createLeagueAction — createLeague échoué', error)
    return { errorCode: 'generic' }
  }

  // redirect() lance une exception NEXT_REDIRECT → doit rester hors du try/catch
  redirect(`/leagues/${leagueId}`)
}

export async function joinLeagueAction(
  _prevState: LeagueActionState<JoinErrorCode>,
  formData:   FormData,
): Promise<LeagueActionState<JoinErrorCode>> {
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
    if (error instanceof LeagueDataError) return { errorCode: error.code }
    console.error('joinLeagueAction — joinLeagueByCode échoué', error)
    return { errorCode: 'generic' }
  }

  redirect(`/leagues/${leagueId}`)
}
