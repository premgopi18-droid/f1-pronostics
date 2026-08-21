// Correspondance libellés d'écurie OpenF1 → codes constructeurs internes (#211).
// OpenF1 (`/drivers`.team_name) utilise ses propres libellés, qui ne matchent ni
// nos codes ni les noms Jolpica (« Red Bull Racing » vs « Red Bull », « Racing
// Bulls » vs « RB F1 Team ») — la correspondance est donc explicite, pas de
// matching flou. Un libellé inconnu (nouvelle écurie, renommage OpenF1) est
// signalé en warning et renvoie null : les appelants retombent sur le mapping
// saison, l'affichage se dégrade sans jamais casser.
const OPENF1_TEAM_NAME_TO_CONSTRUCTOR_CODE: Record<string, string> = {
  'Alpine':          'ALPINE',
  'Aston Martin':    'ASTON_MARTIN',
  'Audi':            'AUDI',
  'Cadillac':        'CADILLAC',
  'Ferrari':         'FERRARI',
  'Haas F1 Team':    'HAAS',
  'McLaren':         'MCLAREN',
  'Mercedes':        'MERCEDES',
  'Racing Bulls':    'RB',
  'Red Bull Racing': 'RED_BULL',
  'Williams':        'WILLIAMS',
}

export function constructorCodeFromOpenF1TeamName(teamName: string): string | null {
  const code = OPENF1_TEAM_NAME_TO_CONSTRUCTOR_CODE[teamName] ?? null
  if (code === null) {
    console.warn(`constructorCodeFromOpenF1TeamName : libellé OpenF1 inconnu — « ${teamName} »`)
  }
  return code
}
