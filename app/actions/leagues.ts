'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { createLeague, joinLeagueByCode, LeagueDataError, type JoinLeagueErrorCode } from '@/lib/data/leagues'
import type { ActionErrorCode } from '@/lib/actions/errors'
import { getCurrentSeason } from '@/lib/api/cron'

// Convention #181 : `error` est un ActionErrorCode, traduit côté form via translateActionError.
export type LeagueActionState = { error: ActionErrorCode } | null

// Mapping domaine → codes d'action (JoinLeagueErrorCode reste le vocabulaire de lib/data).
const JOIN_ERROR_CODE: Record<JoinLeagueErrorCode, ActionErrorCode> = {
  league_not_found: 'leagueNotFound',
  closed:           'leagueClosed',
  already_member:   'alreadyLeagueMember',
  full:             'leagueFull',
  generic:          'somethingWentWrong',
}

export async function createLeagueAction(
  _prevState: LeagueActionState,
  formData:   FormData,
): Promise<LeagueActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'notAuthenticated' }

  const name       = (formData.get('name') as string | null)?.trim() ?? ''
  const maxMembers = parseInt(formData.get('maxMembers') as string, 10)

  if (name.length < 2 || name.length > 50) return { error: 'leagueNameInvalid' }
  if (isNaN(maxMembers) || maxMembers < 2 || maxMembers > 20) return { error: 'leagueSizeInvalid' }

  let leagueId: string
  try {
    const result = await createLeague(user.id, name, maxMembers, getCurrentSeason())
    leagueId = result.leagueId
  } catch (error) {
    console.error('createLeagueAction — createLeague échoué', error)
    return { error: 'somethingWentWrong' }
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
  if (!user) return { error: 'notAuthenticated' }

  const inviteCode = (formData.get('inviteCode') as string | null)?.trim().toUpperCase() ?? ''
  if (!inviteCode) return { error: 'inviteCodeRequired' }

  let leagueId: string
  try {
    const result = await joinLeagueByCode(user.id, inviteCode, getCurrentSeason())
    leagueId = result.leagueId
  } catch (error) {
    if (error instanceof LeagueDataError) return { error: JOIN_ERROR_CODE[error.code] }
    console.error('joinLeagueAction — joinLeagueByCode échoué', error)
    return { error: 'somethingWentWrong' }
  }

  redirect(`/leagues/${leagueId}`)
}
