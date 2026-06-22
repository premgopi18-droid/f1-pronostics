import { cookies } from 'next/headers'
import { joinLeagueByCode } from '@/lib/data/leagues'
import { getCurrentSeason } from '@/lib/api/cron'
import { PENDING_INVITE_COOKIE } from '@/lib/invites'

/**
 * Consomme le code d'invitation en attente (cookie posé par le proxy) : tente
 * l'auto-join, efface le cookie quoi qu'il arrive, et renvoie l'id de la ligue
 * rejointe — ou `null`.
 *
 * **Fail-safe** : toute erreur (code invalide, ligue pleine/fermée, déjà membre)
 * est avalée → `null`. La consommation ne doit jamais bloquer le flux post-login.
 *
 * À appeler dans un Server Action ou un Route Handler (cookies mutables).
 */
export async function consumePendingInvite(userId: string): Promise<string | null> {
  const store = await cookies()
  const code = store.get(PENDING_INVITE_COOKIE)?.value?.trim()
  if (!code) return null

  store.delete(PENDING_INVITE_COOKIE)

  try {
    const { leagueId } = await joinLeagueByCode(userId, code.toUpperCase(), getCurrentSeason())
    return leagueId
  } catch {
    return null
  }
}
