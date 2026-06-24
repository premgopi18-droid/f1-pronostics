export type LeagueJoinStatus = 'open' | 'full' | 'closed' | 'already_member'

/**
 * Statut de jonction d'une ligue, dans l'ordre de priorité :
 * 1. `closed`          — l'admin a fermé les inscriptions (intention explicite) ;
 * 2. `full`            — le nombre max de membres est atteint ;
 * 3. `open`            — on peut rejoindre.
 * 4. `already_member`  — calculé en dehors de cette fonction (dépend du viewer).
 */
export function leagueJoinStatus(
  inviteOpen: boolean,
  memberCount: number,
  maxMembers: number,
): LeagueJoinStatus {
  if (!inviteOpen) return 'closed'
  if (memberCount >= maxMembers) return 'full'
  return 'open'
}
