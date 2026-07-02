import { describe, it, expect } from 'vitest'
import {
  normalizeCoordinates,
  buildSvgPath,
  buildPathFromPoints,
  computeStartMarker,
  computeDirectionMarker,
  type GeoCoordinate,
} from './circuit-svg'

const VIEWBOX_WIDTH = 300
const VIEWBOX_HEIGHT = 200
const PADDING = 20

describe('normalizeCoordinates', () => {
  it('renvoie un tableau vide quand il n\'y a aucune coordonnée', () => {
    expect(normalizeCoordinates([], VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)).toEqual([])
  })

  it('garde tous les points dans les bornes du viewBox (padding inclus)', () => {
    // Carré à l'équateur (cos φ = 1) → pas de distorsion longitudinale.
    const square: GeoCoordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]
    const points = normalizeCoordinates(square, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(PADDING - 0.001)
      expect(x).toBeLessThanOrEqual(VIEWBOX_WIDTH - PADDING + 0.001)
      expect(y).toBeGreaterThanOrEqual(PADDING - 0.001)
      expect(y).toBeLessThanOrEqual(VIEWBOX_HEIGHT - PADDING + 0.001)
    }
  })

  it('remplit la dimension contraignante et centre sur l\'autre', () => {
    // Carré (ratio 1) dans un viewBox 300x200 → limité par la hauteur.
    const square: GeoCoordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    const points = normalizeCoordinates(square, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)
    const ys = points.map(([, y]) => y)
    const xs = points.map(([x]) => x)
    // Étendue verticale = hauteur disponible (bords hauts/bas atteints).
    expect(Math.min(...ys)).toBeCloseTo(PADDING, 5)
    expect(Math.max(...ys)).toBeCloseTo(VIEWBOX_HEIGHT - PADDING, 5)
    // Horizontalement centré : même marge à gauche et à droite.
    expect(Math.min(...xs)).toBeCloseTo(VIEWBOX_WIDTH - Math.max(...xs), 5)
    expect(Math.min(...xs)).toBeGreaterThan(PADDING) // pas collé au bord gauche
  })

  it('préserve le ratio d\'aspect (un tracé allongé reste allongé)', () => {
    // Rectangle 4:1 centré sur l'équateur (cos φ = 1) → largeur = 4 × hauteur.
    const wide: GeoCoordinate[] = [
      [0, -0.5],
      [4, -0.5],
      [4, 0.5],
      [0, 0.5],
    ]
    const points = normalizeCoordinates(wide, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const drawnWidth = Math.max(...xs) - Math.min(...xs)
    const drawnHeight = Math.max(...ys) - Math.min(...ys)
    expect(drawnWidth / drawnHeight).toBeCloseTo(4, 5)
  })

  it('applique la correction cosLat (une latitude élevée comprime la longitude)', () => {
    // Même delta en degrés sur lng et lat, mais à ~60°N (cos 60° = 0,5).
    // La largeur corrigée doit valoir la moitié de la hauteur → dessin plus haut que large.
    const box: GeoCoordinate[] = [
      [10, 60],
      [11, 60],
      [11, 61],
      [10, 61],
    ]
    const points = normalizeCoordinates(box, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const drawnWidth = Math.max(...xs) - Math.min(...xs)
    const drawnHeight = Math.max(...ys) - Math.min(...ys)
    expect(drawnWidth / drawnHeight).toBeCloseTo(Math.cos((60.5 * Math.PI) / 180), 2)
  })

  it('inverse l\'axe Y (nord en haut de l\'écran)', () => {
    const northSouth: GeoCoordinate[] = [
      [0, 0], // sud
      [0, 1], // nord
    ]
    const [south, north] = normalizeCoordinates(northSouth, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)
    expect(north[1]).toBeLessThan(south[1]) // le point nord a un Y plus petit (plus haut)
  })

  it('ne renvoie pas de NaN pour un tracé dégénéré (points identiques)', () => {
    const degenerate: GeoCoordinate[] = [
      [5, 45],
      [5, 45],
    ]
    const points = normalizeCoordinates(degenerate, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)
    for (const [x, y] of points) {
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  })
})

describe('buildSvgPath', () => {
  it('renvoie une chaîne vide quand il n\'y a aucune coordonnée', () => {
    expect(buildSvgPath([], VIEWBOX_WIDTH, VIEWBOX_HEIGHT, PADDING)).toBe('')
  })

  it('commence par M et contient un L par point intermédiaire', () => {
    const path = buildSvgPath(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      VIEWBOX_WIDTH,
      VIEWBOX_HEIGHT,
      PADDING,
    )
    expect(path.startsWith('M ')).toBe(true)
    expect((path.match(/L /g) ?? []).length).toBe(2)
  })

  it('ferme le tracé (Z) quand premier et dernier point coïncident', () => {
    const closed = buildPathFromPoints([
      [10, 10],
      [50, 10],
      [50, 50],
      [10, 10],
    ])
    expect(closed.endsWith('Z')).toBe(true)
  })

  it('ne ferme pas un tracé ouvert', () => {
    const open = buildPathFromPoints([
      [10, 10],
      [50, 10],
      [50, 50],
    ])
    expect(open.endsWith('Z')).toBe(false)
  })
})

describe('computeStartMarker / computeDirectionMarker', () => {
  it('renvoie null pour un tracé de moins de deux points', () => {
    expect(computeStartMarker([[10, 10]])).toBeNull()
    expect(computeDirectionMarker([[10, 10]], 0.5)).toBeNull()
  })

  it('pose le marqueur de départ sur le premier point, orienté vers le suivant', () => {
    const marker = computeStartMarker([
      [10, 10],
      [30, 10], // vers la droite → angle 0°
    ])
    expect(marker).not.toBeNull()
    expect(marker!.x).toBe(10)
    expect(marker!.y).toBe(10)
    expect(marker!.angleDegrees).toBeCloseTo(0, 5)
  })

  it('oriente la flèche selon la tangente locale', () => {
    // Segment vertical vers le bas → angle 90° (repère SVG Y vers le bas).
    const marker = computeDirectionMarker(
      [
        [10, 10],
        [10, 40],
      ],
      0,
    )
    expect(marker!.angleDegrees).toBeCloseTo(90, 5)
  })
})