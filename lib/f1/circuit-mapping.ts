// Mapping nom de circuit Jolpica (`grands_prix.circuit`) → identifiant bacinger
// (`bacinger/f1-circuits`, clé primaire de `circuit_tracks`).
//
// Les noms Jolpica ne matchent pas toujours le `Name` bacinger (accents, "di Monza"
// vs "Monza", "Strip Street" vs "Street"…) : cette table absorbe l'écart. Les clés
// sont les noms EXACTS renvoyés par Jolpica (vérifiés contre `grands_prix` en prod,
// saison 2026). Un circuit absent de la table → pas de tracé affiché (fallback).

export const CIRCUIT_NAME_TO_BACINGER_ID: Record<string, string> = {
  // Calendrier 2026 (noms Jolpica réels)
  'Albert Park Grand Prix Circuit': 'au-1953',
  'Autódromo Hermanos Rodríguez':   'mx-1962',
  'Autódromo José Carlos Pace':     'br-1940',
  'Autodromo Nazionale di Monza':   'it-1922',
  'Baku City Circuit':              'az-2016',
  'Circuit de Barcelona-Catalunya': 'es-1991',
  'Circuit de Monaco':              'mc-1929',
  'Circuit de Spa-Francorchamps':   'be-1925',
  'Circuit Gilles Villeneuve':      'ca-1978',
  'Circuit of the Americas':        'us-2012',
  'Circuit Park Zandvoort':         'nl-1948',
  'Hungaroring':                    'hu-1986',
  'Las Vegas Strip Street Circuit': 'us-2023',
  'Losail International Circuit':    'qa-2004',
  'Madring':                        'es-2026',
  'Marina Bay Street Circuit':      'sg-2008',
  'Miami International Autodrome':   'us-2022',
  'Red Bull Ring':                  'at-1969',
  'Shanghai International Circuit':  'cn-2004',
  'Silverstone Circuit':            'gb-1948',
  'Suzuka Circuit':                 'jp-1962',
  'Yas Marina Circuit':             'ae-2009',

  // Circuits F1 récurrents hors calendrier 2026 courant (future-proofing) — noms
  // Jolpica standards. Sans effet tant qu'ils n'apparaissent pas dans `grands_prix`.
  'Bahrain International Circuit':   'bh-2002',
  'Jeddah Corniche Circuit':        'sa-2021',
  'Autodromo Enzo e Dino Ferrari':  'it-1953',
}

/**
 * Résout l'identifiant bacinger d'un circuit depuis son nom Jolpica.
 * Retourne `null` si le circuit n'est pas cartographié (fallback gracieux).
 */
export function getBacingerId(jolpicaCircuitName: string): string | null {
  return CIRCUIT_NAME_TO_BACINGER_ID[jolpicaCircuitName] ?? null
}