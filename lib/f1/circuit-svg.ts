// Projection d'un tracé de circuit (coordonnées GeoJSON [longitude, latitude]) vers
// un espace SVG, en pur TypeScript (pas de librairie de cartographie).
//
// Point clé : 1° de longitude ≠ 1° de latitude en distance réelle. Le facteur diminue
// avec la latitude (cos φ) : à Monaco (~43,7°N) un degré de longitude vaut ~0,72 degré
// de latitude. Sans correction, les circuits seraient étirés horizontalement. On corrige
// donc la longitude par `cos(latitudeMoyenne)` avant de fitter en préservant le ratio.

export type GeoCoordinate = [number, number] // [longitude, latitude]
export type SvgPoint = [number, number]      // [x, y] dans l'espace du viewBox

/** Position + orientation d'un marqueur posé sur le tracé (repère SVG). */
export interface TrackMarker {
  x: number
  y: number
  angleDegrees: number // tangente locale, sens de parcours (repère SVG, Y vers le bas)
}

/**
 * Normalise des coordonnées géographiques vers l'espace du viewBox.
 *
 * - corrige la distorsion longitudinale via `cos(latitudeMoyenne)` ;
 * - préserve le ratio d'aspect (le tracé n'est jamais écrasé) ;
 * - centre le tracé dans le viewBox, en laissant `paddingPixels` sur les bords.
 *
 * Retourne un tableau vide si `coordinates` est vide, et un tracé dégénéré (tous les
 * points au centre) si son étendue est nulle sur un axe.
 */
export function normalizeCoordinates(
  coordinates: GeoCoordinate[],
  viewBoxWidth: number,
  viewBoxHeight: number,
  paddingPixels: number,
): SvgPoint[] {
  if (coordinates.length === 0) return []

  let minLongitude = Infinity
  let maxLongitude = -Infinity
  let minLatitude = Infinity
  let maxLatitude = -Infinity

  for (const [longitude, latitude] of coordinates) {
    if (longitude < minLongitude) minLongitude = longitude
    if (longitude > maxLongitude) maxLongitude = longitude
    if (latitude < minLatitude) minLatitude = latitude
    if (latitude > maxLatitude) maxLatitude = latitude
  }

  const meanLatitude = (minLatitude + maxLatitude) / 2
  const longitudeCorrection = Math.cos((meanLatitude * Math.PI) / 180)

  // Étendue « géographique corrigée » : la longitude est ramenée à l'échelle de la latitude.
  const correctedLongitudeSpan = (maxLongitude - minLongitude) * longitudeCorrection
  const latitudeSpan = maxLatitude - minLatitude

  const availableWidth = viewBoxWidth - 2 * paddingPixels
  const availableHeight = viewBoxHeight - 2 * paddingPixels

  // Un seul facteur d'échelle pour les deux axes → ratio d'aspect préservé.
  const scale = Math.min(
    correctedLongitudeSpan > 0 ? availableWidth / correctedLongitudeSpan : Infinity,
    latitudeSpan > 0 ? availableHeight / latitudeSpan : Infinity,
  )
  const safeScale = Number.isFinite(scale) ? scale : 0

  // Centrage : marge résiduelle répartie de part et d'autre du tracé dessiné.
  const drawnWidth = correctedLongitudeSpan * safeScale
  const drawnHeight = latitudeSpan * safeScale
  const offsetX = (viewBoxWidth - drawnWidth) / 2
  const offsetY = (viewBoxHeight - drawnHeight) / 2

  return coordinates.map(([longitude, latitude]) => {
    const x = offsetX + (longitude - minLongitude) * longitudeCorrection * safeScale
    // Y inversé : la latitude croît vers le nord (haut), mais l'axe Y du SVG descend.
    const y = offsetY + (maxLatitude - latitude) * safeScale
    return [x, y]
  })
}

/** Construit une chaîne de path SVG ("M x y L x y …") depuis des points déjà normalisés. */
export function buildPathFromPoints(points: SvgPoint[]): string {
  if (points.length === 0) return ''

  const [firstX, firstY] = points[0]
  const segments = [`M ${round(firstX)} ${round(firstY)}`]
  for (let index = 1; index < points.length; index++) {
    const [x, y] = points[index]
    segments.push(`L ${round(x)} ${round(y)}`)
  }

  // Ferme proprement le tracé si le GeoJSON est déjà un anneau (premier ≈ dernier point).
  const [lastX, lastY] = points[points.length - 1]
  if (points.length > 2 && isClose(firstX, lastX) && isClose(firstY, lastY)) {
    segments.push('Z')
  }

  return segments.join(' ')
}

/**
 * Chaîne de path SVG directement depuis des coordonnées géographiques.
 * Raccourci `buildPathFromPoints(normalizeCoordinates(...))`, pratique et testable.
 */
export function buildSvgPath(
  coordinates: GeoCoordinate[],
  viewBoxWidth: number,
  viewBoxHeight: number,
  paddingPixels: number,
): string {
  return buildPathFromPoints(
    normalizeCoordinates(coordinates, viewBoxWidth, viewBoxHeight, paddingPixels),
  )
}

/**
 * Marqueur de ligne de départ/arrivée : posé sur le premier point du tracé, orienté
 * selon la tangente locale (sens de parcours). `null` si le tracé est trop court.
 */
export function computeStartMarker(points: SvgPoint[]): TrackMarker | null {
  if (points.length < 2) return null
  return markerAtIndex(points, 0)
}

/**
 * Marqueur de sens de parcours (flèche) : posé à `fraction` de l'index du tracé,
 * orienté selon la tangente locale. `fraction` dans [0, 1]. `null` si trop court.
 */
export function computeDirectionMarker(points: SvgPoint[], fraction: number): TrackMarker | null {
  if (points.length < 2) return null
  const clamped = Math.min(Math.max(fraction, 0), 1)
  const index = Math.min(Math.round(clamped * (points.length - 1)), points.length - 2)
  return markerAtIndex(points, index)
}

// ── Helpers internes ────────────────────────────────────────────────────────

// Tangente au point `index`, dirigée vers le point suivant (sens de parcours du tracé).
function markerAtIndex(points: SvgPoint[], index: number): TrackMarker {
  const [x, y] = points[index]
  const [nextX, nextY] = points[index + 1]
  const angleDegrees = (Math.atan2(nextY - y, nextX - x) * 180) / Math.PI
  return { x, y, angleDegrees }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01
}