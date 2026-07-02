// Nombre de virages par circuit — donnée curée à la main.
//
// Contrairement aux tours (désormais dérivés automatiquement des résultats F1, voir
// `grands_prix.race_laps` + #174), le nombre de virages n'existe dans AUCUNE source
// exploitable (ni bacinger, ni Jolpica, ni OpenF1). Le scraping Wikipédia/Wikidata est
// écarté : fragile, pour une valeur qui ne change qu'à une reconfiguration physique du
// circuit (rare). On maintient donc une table curée, avec revue annuelle.
//
// Clé = identifiant bacinger (voir `circuit-mapping.ts`). Valeur = configuration de l'ère
// actuelle. Circuit absent → la statistique n'est pas affichée (fallback gracieux).
//
// ⚠️ REVUE ANNUELLE (checklist docs/product-specs §3.3) : en début de saison, revérifier
//    les circuits reconfigurés et ajouter les nouveaux tracés du calendrier.
//    Dernière vérification : 2026 (calendrier 2026).

export const TURNS_BY_CIRCUIT: Record<string, number> = {
  'au-1953': 14,
  'mx-1962': 17,
  'br-1940': 15,
  'it-1922': 11,
  'az-2016': 20,
  'es-1991': 14,
  'mc-1929': 19,
  'be-1925': 19,
  'ca-1978': 14,
  'us-2012': 20,
  'nl-1948': 14,
  'hu-1986': 14,
  'us-2023': 17,
  'qa-2004': 16,
  'sg-2008': 19,
  'us-2022': 19,
  'at-1969': 10,
  'cn-2004': 16,
  'gb-1948': 18,
  'jp-1962': 18,
  'ae-2009': 16,
  'bh-2002': 15,
  'sa-2021': 27,
  'it-1953': 19,
}

/** Nombre de virages pour un circuit, ou `null` si inconnu. */
export function getTurnsForCircuit(bacingerId: string): number | null {
  return TURNS_BY_CIRCUIT[bacingerId] ?? null
}
