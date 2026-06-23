/** Correspondance pays Jolpica (anglais) → noms d'affichage français. */
const COUNTRY_FR_MAP: Record<string, { name: string; gpName: string }> = {
  Bahrain:            { name: 'Bahreïn',          gpName: "Grand Prix de Bahreïn" },
  'Saudi Arabia':     { name: 'Arabie Saoudite',  gpName: "Grand Prix d'Arabie Saoudite" },
  Australia:          { name: 'Australie',         gpName: "Grand Prix d'Australie" },
  Japan:              { name: 'Japon',             gpName: "Grand Prix du Japon" },
  China:              { name: 'Chine',             gpName: "Grand Prix de Chine" },
  'United States':    { name: 'États-Unis',        gpName: "Grand Prix des États-Unis" },
  'Emilia-Romagna':   { name: 'Émilie-Romagne',    gpName: "Grand Prix d'Émilie-Romagne" },
  Monaco:             { name: 'Monaco',            gpName: "Grand Prix de Monaco" },
  Canada:             { name: 'Canada',            gpName: "Grand Prix du Canada" },
  Spain:              { name: 'Espagne',           gpName: "Grand Prix d'Espagne" },
  Austria:            { name: 'Autriche',          gpName: "Grand Prix d'Autriche" },
  'Great Britain':    { name: 'Grande-Bretagne',   gpName: "Grand Prix de Grande-Bretagne" },
  Hungary:            { name: 'Hongrie',           gpName: "Grand Prix de Hongrie" },
  Belgium:            { name: 'Belgique',          gpName: "Grand Prix de Belgique" },
  Netherlands:        { name: 'Pays-Bas',          gpName: "Grand Prix des Pays-Bas" },
  Italy:              { name: 'Italie',            gpName: "Grand Prix d'Italie" },
  Azerbaijan:         { name: 'Azerbaïdjan',       gpName: "Grand Prix d'Azerbaïdjan" },
  Singapore:          { name: 'Singapour',         gpName: "Grand Prix de Singapour" },
  Mexico:             { name: 'Mexique',           gpName: "Grand Prix du Mexique" },
  Brazil:             { name: 'Brésil',            gpName: "Grand Prix du Brésil" },
  Qatar:              { name: 'Qatar',             gpName: "Grand Prix du Qatar" },
  'Abu Dhabi':        { name: 'Abou Dabi',         gpName: "Grand Prix d'Abou Dabi" },
  'Las Vegas':        { name: 'Las Vegas',         gpName: "Grand Prix de Las Vegas" },
  Miami:              { name: 'Miami',             gpName: "Grand Prix de Miami" },
}

/** Nom court du pays en français (ex: "Austria" → "Autriche"). */
export function getCountryNameFr(country: string): string {
  return COUNTRY_FR_MAP[country]?.name ?? country
}

/** Nom complet du GP en français (ex: "Austria" → "Grand Prix d'Autriche"). */
export function getGpNameFr(country: string): string {
  return COUNTRY_FR_MAP[country]?.gpName ?? `Grand Prix de ${country}`
}
