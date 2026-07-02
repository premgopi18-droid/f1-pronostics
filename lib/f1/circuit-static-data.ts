// Données statiques par circuit — nombre de tours de course et nombre de virages.
// Absentes de bacinger ET du calendrier Jolpica, elles sont maintenues à la main.
//
// Clé = identifiant bacinger (voir `circuit-mapping.ts`). Valeurs de l'ère actuelle
// (susceptibles d'être ajustées si un tracé change). Un circuit absent d'une table
// → la statistique correspondante n'est simplement pas affichée (fallback gracieux).
// Madring (es-2026) : nouveau tracé, distance de course non figée → volontairement omis.

export const LAPS_BY_CIRCUIT: Record<string, number> = {
  'au-1953': 58,
  'mx-1962': 71,
  'br-1940': 71,
  'it-1922': 53,
  'az-2016': 51,
  'es-1991': 66,
  'mc-1929': 78,
  'be-1925': 44,
  'ca-1978': 70,
  'us-2012': 56,
  'nl-1948': 72,
  'hu-1986': 70,
  'us-2023': 50,
  'qa-2004': 57,
  'sg-2008': 62,
  'us-2022': 57,
  'at-1969': 71,
  'cn-2004': 56,
  'gb-1948': 52,
  'jp-1962': 53,
  'ae-2009': 58,
  'bh-2002': 57,
  'sa-2021': 50,
  'it-1953': 63,
}

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

/** Nombre de tours de course pour un circuit, ou `null` si inconnu. */
export function getLapsForCircuit(bacingerId: string): number | null {
  return LAPS_BY_CIRCUIT[bacingerId] ?? null
}

/** Nombre de virages pour un circuit, ou `null` si inconnu. */
export function getTurnsForCircuit(bacingerId: string): number | null {
  return TURNS_BY_CIRCUIT[bacingerId] ?? null
}