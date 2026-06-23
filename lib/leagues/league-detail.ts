export type GrandPrixSummary = {
  id: string;
  name: string;
  country: string;
  round: number;
  weekend_starts_at: string;
  scoring_finalized_at: string | null;
};

/** Prochain GP dont le weekend n'a pas encore commencé par rapport à `now`. */
export function findUpcomingGp(
  grandsPrix: GrandPrixSummary[],
  now: Date,
): GrandPrixSummary | null {
  const upcoming = grandsPrix.filter(
    (gp) => new Date(gp.weekend_starts_at) > now,
  );
  if (upcoming.length === 0) return null;
  return upcoming.reduce((closest, gp) =>
    new Date(gp.weekend_starts_at) < new Date(closest.weekend_starts_at) ? gp : closest,
  );
}

/** Derniers GPs finalisés (scoring_finalized_at non null), triés par round décroissant, limités à `limit`. */
export function getLastFinalizedGps(
  grandsPrix: GrandPrixSummary[],
  limit: number,
): GrandPrixSummary[] {
  return grandsPrix
    .filter((gp) => gp.scoring_finalized_at != null)
    .sort((a, b) => b.round - a.round)
    .slice(0, limit);
}
