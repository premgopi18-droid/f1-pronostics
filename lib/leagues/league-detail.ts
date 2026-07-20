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

/**
 * GP le plus récent dont le weekend a déjà commencé (`weekend_starts_at <= now`).
 * = le GP en cours si un weekend est en cours, sinon le dernier GP passé.
 * Sert à cibler la page compare (pronos verrouillés). `null` si la saison n'a pas démarré.
 */
export function findCurrentOrLastGp(
  grandsPrix: GrandPrixSummary[],
  now: Date,
): GrandPrixSummary | null {
  const started = grandsPrix.filter(
    (gp) => new Date(gp.weekend_starts_at) <= now,
  );
  if (started.length === 0) return null;
  return started.reduce((latest, gp) => (gp.round > latest.round ? gp : latest));
}

/**
 * GP courant au sens des items : premier GP (plus petit round) dont le scoring
 * n'est pas finalisé — même définition que `getCurrentGp` (lib/data/current-gp.ts,
 * product-specs §3.5). Cible du bouton « Jouer un item » : contrairement à
 * `findUpcomingGp`, le GP reste ciblé pendant tout son week-end (les items
 * « avant la course » sont jouables jusqu'au départ). `null` en fin de saison.
 *
 * Suppose une liste SANS GP annulés (comme les autres helpers de ce module) :
 * un GP annulé n'étant jamais finalisé, il serait sinon épinglé comme courant.
 * L'appelant (page ligue) filtre déjà `is_cancelled = false` en amont —
 * `GrandPrixSummary` ne porte donc pas ce champ.
 */
export function findCurrentItemsGp(
  grandsPrix: GrandPrixSummary[],
): GrandPrixSummary | null {
  const notFinalized = grandsPrix.filter((gp) => gp.scoring_finalized_at == null);
  if (notFinalized.length === 0) return null;
  return notFinalized.reduce((first, gp) => (gp.round < first.round ? gp : first));
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
