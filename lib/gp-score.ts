/**
 * Score brut d'un GP = somme des `base_score` des sessions du GP.
 *
 * `base_score` est **global** (identique quelle que soit la ligue : il ne dépend que
 * de la prédiction vs le résultat). Comme il est stocké par (user, ligue, session),
 * un utilisateur dans plusieurs ligues a plusieurs lignes par session — on déduplique
 * donc par `sessionId` avant de sommer, pour ne pas compter une session plusieurs fois.
 */
export function rawGpScore(
  sessionScores: ReadonlyArray<{ sessionId: string; baseScore: number }>,
): number {
  const bySession = new Map<string, number>();
  for (const { sessionId, baseScore } of sessionScores) {
    if (!bySession.has(sessionId)) bySession.set(sessionId, baseScore);
  }
  let total = 0;
  for (const score of bySession.values()) total += score;
  return total;
}
