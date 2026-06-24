export type LeagueJoinStatus = 'open' | 'full' | 'closed'

/**
 * Statut d'affichage de la landing d'invitation : le statut de jonction, plus
 * `already_member` — qui dépend du viewer et est calculé dans `getLeagueByCode`,
 * pas par `leagueJoinStatus()`.
 */
export type LeaguePreviewStatus = LeagueJoinStatus | 'already_member'

/**
 * Statut de jonction d'une ligue, dans l'ordre de priorité :
 * 1. `closed` — l'admin a fermé les inscriptions (intention explicite) ;
 * 2. `full`   — le nombre max de membres est atteint ;
 * 3. `open`   — on peut rejoindre.
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
