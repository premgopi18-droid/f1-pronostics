'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'

type AdminResult = { error?: string; success?: boolean; inviteOpen?: boolean }

// Garde-fou applicatif : un Server Action est un endpoint POST public, le gate UI
// (`isAdmin` dans page.tsx) ne protège pas l'appel direct. On vérifie l'admin-ship
// dans le code — défense en profondeur indépendante de la policy RLS. La condition
// (user + league + saison courante) est identique à celle qui affiche le panel.
async function assertAdmin(leagueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const }

  const { data: membership } = await supabase
    .from('league_members')
    .select('is_admin')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .eq('season', getCurrentSeason())
    .maybeSingle()

  if (!membership?.is_admin) return { error: 'Action réservée à l\'administrateur de la ligue' as const }
  return { supabase }
}

export async function toggleInvites(leagueId: string): Promise<AdminResult> {
  const auth = await assertAdmin(leagueId)
  if ('error' in auth) return auth

  // Toggle atomique en base (un seul UPDATE) qui renvoie le nouvel état : le client
  // n'a rien à inférer, donc plus de divergence UI sur un onglet périmé (cf. #23),
  // et deux admins concurrents ne peuvent plus se neutraliser.
  const { data: inviteOpen, error } = await auth.supabase
    .rpc('toggle_invites', { p_league_id: leagueId })

  if (error || typeof inviteOpen !== 'boolean') return { error: 'Erreur lors de la mise à jour' }

  revalidatePath(`/leagues/${leagueId}`)
  return { success: true, inviteOpen }
}

export async function transferAdmin(leagueId: string, targetUserId: string): Promise<AdminResult> {
  const auth = await assertAdmin(leagueId)
  if ('error' in auth) return auth

  const { supabase } = auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const season = getCurrentSeason()

  // Promouvoir la cible en premier — si ça échoue, le transfert n'a pas eu lieu.
  const { error: promoteError } = await supabase
    .from('league_members')
    .update({ is_admin: true })
    .eq('league_id', leagueId)
    .eq('user_id', targetUserId)
    .eq('season', season)

  if (promoteError) return { error: 'Erreur lors du transfert' }

  // Rétrograder l'admin courant.
  const { error: demoteError } = await supabase
    .from('league_members')
    .update({ is_admin: false })
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .eq('season', season)

  if (demoteError) {
    // Rollback : annuler la promotion
    await supabase
      .from('league_members')
      .update({ is_admin: false })
      .eq('league_id', leagueId)
      .eq('user_id', targetUserId)
      .eq('season', season)
    return { error: 'Erreur lors du transfert' }
  }

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/admin`)
  return { success: true }
}

export async function regenerateInviteCode(leagueId: string): Promise<AdminResult> {
  const auth = await assertAdmin(leagueId)
  if ('error' in auth) return auth

  const { supabase } = auth

  // Même format que create_league : 8 hex majuscules, retry sur collision UNIQUE (rarissime)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

    const { error } = await supabase
      .from('leagues')
      .update({ invite_code: code })
      .eq('id', leagueId)

    if (!error) {
      revalidatePath(`/leagues/${leagueId}`)
      return { success: true }
    }

    if (error.code !== '23505') return { error: 'Erreur lors de la régénération' }
  }

  return { error: 'Impossible de générer un code unique' }
}
