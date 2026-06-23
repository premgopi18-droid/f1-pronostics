/** Correspondance pays Jolpica (anglais) → code ISO-2. */
const COUNTRY_CODE_MAP: Record<string, string> = {
  Bahrain: "BH",
  "Saudi Arabia": "SA",
  Australia: "AU",
  Japan: "JP",
  China: "CN",
  "United States": "US",
  "Emilia-Romagna": "IT",
  Monaco: "MC",
  Canada: "CA",
  Spain: "ES",
  Austria: "AT",
  "Great Britain": "GB",
  Hungary: "HU",
  Belgium: "BE",
  Netherlands: "NL",
  Italy: "IT",
  Azerbaijan: "AZ",
  Singapore: "SG",
  Mexico: "MX",
  Brazil: "BR",
  Qatar: "QA",
  "Abu Dhabi": "AE",
  // Circuits spécifiques parfois retournés par Jolpica
  "Las Vegas": "US",
  Miami: "US",
};

/** Retourne le code ISO-2 du pays, ou les 2 premières lettres en majuscules en fallback. */
export function getCountryCode(country: string): string {
  return COUNTRY_CODE_MAP[country] ?? country.slice(0, 2).toUpperCase();
}
