import { ITEM_BONUS_POINTS } from './constants'
import type {
  DriverResult,
  GPItemType,
  PlayedItem,
  ScoreKey,
  SessionScore,
  ResolutionContext,
} from './types'

// ============================================================
// Duo réel d'une course — constructorCode → [driverCode, ...]
// Dérivé des résultats de LA course (session_results.constructor_code, #205) :
// reflète les remplacements et échanges de baquet, contrairement au mapping
// saison drivers.constructor_id. Map vide si les résultats ne portent pas
// l'écurie (sessions antérieures à #205) — l'appelant retombe alors sur
// getConstructorDriversMap(season).
// ============================================================

export function buildConstructorDrivers(
  results: Map<string, DriverResult>,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const [driverCode, result] of results) {
    if (!result.constructorCode) continue
    const drivers = map.get(result.constructorCode) ?? []
    drivers.push(driverCode)
    map.set(result.constructorCode, drivers)
  }
  return map
}

// ============================================================
// Ordre de résolution (spec §3.5) — source unique.
// applyItemEffects applique les resolvers dans cet ordre ; les faits marquants
// (lib/items/facts.ts) s'en servent pour ordonner l'affichage. Un seul endroit à
// modifier si la séquence change.
// ============================================================

export const ITEM_RESOLUTION_ORDER = [
  'shield',
  'block_driver',
  'wild_card',
  'double_points',
  'dnf_prediction',
  'underdog_top5',
  'no_points_team',
] as const

// ============================================================
// Helpers
// ============================================================

type ItemResolver = (
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
) => void

function scoreKey(userId: string, sessionType: string): ScoreKey {
  return `${userId}:${sessionType}` as ScoreKey
}

// ============================================================
// Étape 2 — Boucliers
// Modifie wasShielded/effectApplied sur les items offensifs in-place.
// ============================================================

export function resolveShields(items: PlayedItem[]): void {
  for (const shield of items) {
    if (shield.payload.type !== 'shield') continue
    for (const offensive of items) {
      if (
        offensive.payload.type !== 'block_driver' &&
        offensive.payload.type !== 'wild_card'
      ) continue
      if (offensive.payload.targetUserId === shield.userId) {
        offensive.wasShielded   = true
        offensive.effectApplied = false
      }
    }
  }
}

// ============================================================
// Étape 3 — Bloquer un pilote
// Retire les points de POSITION du pilote ciblé (FL non affecté).
// ============================================================

function resolveBlock(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  _ctx: ResolutionContext,
): void {
  if (item.payload.type !== 'block_driver') return
  const { targetUserId, sessionType, driverCode } = item.payload

  const victim = scores.get(scoreKey(targetUserId, sessionType))
  if (!victim) {
    item.effectApplied     = false
    item.pointsDeltaActor  = 0
    item.pointsDeltaTarget = 0
    return
  }

  const pts = victim.breakdown.find(e => e.code === driverCode)?.pts ?? 0
  victim.finalScore -= pts
  item.effectApplied     = pts > 0
  item.pointsDeltaActor  = 0              // bloquer ne rapporte rien à l'acteur
  item.pointsDeltaTarget = pts > 0 ? -pts : 0  // retire les points de position à la cible
}

// ============================================================
// Étape 4 — Wild Cards (résolution parallèle via snapshot)
// Chaque vol calculé sur le score ORIGINAL (pre-wildcard).
// ============================================================

export function resolveWildCards(
  wcItems: PlayedItem[],
  scores: Map<ScoreKey, SessionScore>,
): void {
  // Snapshot AVANT la boucle
  const snapshot = new Map<ScoreKey, number>()
  for (const [k, s] of scores) snapshot.set(k, s.finalScore)

  for (const wc of wcItems) {
    if (wc.payload.type !== 'wild_card') continue
    const { targetUserId, sessionType } = wc.payload

    const victimKey   = scoreKey(targetUserId, sessionType)
    const attackerKey = scoreKey(wc.userId, sessionType)
    const stolen      = Math.floor((snapshot.get(victimKey) ?? 0) / 2)

    const victim   = scores.get(victimKey)
    const attacker = scores.get(attackerKey)

    if (victim)   victim.finalScore   -= stolen
    if (attacker) attacker.finalScore += stolen

    wc.payload.pointsStolen = stolen
    wc.effectApplied        = true
    wc.pointsDeltaActor     = stolen                 // l'attaquant encaisse
    wc.pointsDeltaTarget    = stolen > 0 ? -stolen : 0  // la cible perd
  }
}

// ============================================================
// Étape 5 — Dernier tour de magie (×2 intentionnellement après wild_card)
// ============================================================

function resolveDouble(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  _ctx: ResolutionContext,
): void {
  if (item.payload.type !== 'double_points') return
  const score = scores.get(scoreKey(item.userId, item.payload.sessionType))
  item.pointsDeltaTarget = null   // item non offensif : pas de cible
  if (score) {
    const before = score.finalScore
    score.finalScore *= 2
    item.effectApplied    = true
    item.pointsDeltaActor = score.finalScore - before
  } else {
    item.pointsDeltaActor = 0
  }
}

// ============================================================
// Étape 6 — Items de prédiction bonus
// Appliqués APRÈS le ×2, non doublables.
// ============================================================

function resolveDnfPrediction(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
): void {
  if (item.payload.type !== 'dnf_prediction') return
  // DNS (dnf absent/false) = item wasted — seul dnf=true déclenche le bonus
  const confirmed = ctx.raceResults.get(item.payload.driverCode)?.dnf === true
  const score     = scores.get(scoreKey(item.userId, 'race'))
  const applied   = confirmed && score != null
  if (applied) score!.finalScore += ITEM_BONUS_POINTS.dnf_prediction
  item.effectApplied     = confirmed
  item.pointsDeltaActor  = applied ? ITEM_BONUS_POINTS.dnf_prediction : 0
  item.pointsDeltaTarget = null
}

function resolveUnderdogTop5(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
): void {
  if (item.payload.type !== 'underdog_top5') return
  const { driverCode } = item.payload
  const qualPos  = ctx.qualifyingResults.get(driverCode)?.position ?? null
  const racePos  = ctx.raceResults.get(driverCode)?.position ?? null

  // DNS qualif (position null) = hors top 10 par défaut → éligible
  const isUnderdog   = qualPos === null || qualPos > 10
  const finishedTop5 = racePos !== null && racePos <= 5

  const triggered = isUnderdog && finishedTop5
  const score     = scores.get(scoreKey(item.userId, 'race'))
  const applied   = triggered && score != null
  if (applied) score!.finalScore += ITEM_BONUS_POINTS.underdog_top5
  item.effectApplied     = triggered
  item.pointsDeltaActor  = applied ? ITEM_BONUS_POINTS.underdog_top5 : 0
  item.pointsDeltaTarget = null
}

function resolveNoPointsTeam(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
): void {
  if (item.payload.type !== 'no_points_team') return
  const drivers = ctx.constructorDrivers.get(item.payload.constructorCode) ?? []

  // Écurie introuvable dans la map (code invalide ou données absentes) : la condition
  // est invérifiable — jamais de bonus par défaut, l'item reste sans effet.
  if (drivers.length === 0) {
    item.effectApplied     = false
    item.pointsDeltaActor  = 0
    item.pointsDeltaTarget = null
    return
  }

  const teamScored = drivers.some(code => {
    const pos = ctx.raceResults.get(code)?.position
    return pos !== null && pos !== undefined && pos <= 10
  })
  const score   = scores.get(scoreKey(item.userId, 'race'))
  const applied = !teamScored && score != null
  if (applied) score!.finalScore += ITEM_BONUS_POINTS.no_points_team
  item.effectApplied     = !teamScored
  item.pointsDeltaActor  = applied ? ITEM_BONUS_POINTS.no_points_team : 0
  item.pointsDeltaTarget = null
}

// ============================================================
// Handler map
// shield et wild_card dispatché séparément (signatures différentes).
// fia_penalty volontairement absent — nice-to-have non implémenté (voir product-specs §3.5).
// ============================================================

const RESOLVERS: Record<
  Exclude<GPItemType, 'shield' | 'wild_card' | 'fia_penalty'>,
  ItemResolver
> = {
  block_driver:   resolveBlock,
  double_points:  resolveDouble,
  dnf_prediction: resolveDnfPrediction,
  underdog_top5:  resolveUnderdogTop5,
  no_points_team: resolveNoPointsTeam,
}

// ============================================================
// Fonction PURE principale — zéro I/O
// ============================================================

export function applyItemEffects(
  items: PlayedItem[],
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
): Map<ScoreKey, SessionScore> {
  const active = (type: GPItemType) =>
    items.filter(i => i.payload.type === type && !i.wasShielded)

  resolveShields(items)
  active('block_driver').forEach(i => RESOLVERS.block_driver(i, scores, ctx))
  resolveWildCards(active('wild_card'), scores)
  active('double_points').forEach(i => RESOLVERS.double_points(i, scores, ctx))

  for (const type of ['dnf_prediction', 'underdog_top5', 'no_points_team'] as const) {
    active(type).forEach(i => RESOLVERS[type](i, scores, ctx))
  }

  // Pas de passe de rattrapage : les deltas sont initialisés à 0/0 à la construction
  // (lib/data/items.ts). Un item non touché par un resolver — bouclier, ou item
  // offensif annulé par un bouclier (exclu par `active`) — reste donc à 0/0.
  return scores
}
