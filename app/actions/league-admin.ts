'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'

type AdminResult = { error?: string; success?: boolean }

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

  const { data: league } = await auth.supabase
    .from('leagues')
    .select('invite_open')
    .eq('id', leagueId)
    .single()

  if (!league) return { error: 'Ligue introuvable' }

  const { error } = await auth.supabase
    .from('leagues')
    .update({ invite_open: !league.invite_open })
    .eq('id', leagueId)

  if (error) return { error: 'Erreur lors de la mise à jour' }

  revalidatePath(`/leagues/${leagueId}`)
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
