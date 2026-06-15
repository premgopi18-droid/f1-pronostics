import { ITEM_BONUS_POINTS } from './constants'
import type {
  GPItemType,
  ItemPayload,
  PlayedItem,
  ScoreKey,
  SessionScore,
  ResolutionContext,
} from './types'

// ============================================================
// Helpers
// ============================================================

type ItemResolver = (
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
) => void

function key(userId: string, sessionType: string): ScoreKey {
  return `${userId}:${sessionType}` as ScoreKey
}

type OffensivePayload = Extract<ItemPayload, { type: 'block_driver' } | { type: 'wild_card' }>

// ============================================================
// Étape 2 — Boucliers
// Modifie wasShielded/effectApplied sur les items offensifs in-place.
// ============================================================

export function resolveShields(items: PlayedItem[]): void {
  for (const shield of items.filter(i => i.type === 'shield')) {
    for (const offensive of items) {
      if (offensive.type !== 'block_driver' && offensive.type !== 'wild_card') continue
      const payload = offensive.payload as OffensivePayload
      if (payload.targetUserId === shield.userId) {
        offensive.wasShielded  = true
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
  const { targetUserId, sessionType, driverCode } =
    item.payload as Extract<ItemPayload, { type: 'block_driver' }>

  const victim = scores.get(key(targetUserId, sessionType))
  if (!victim) { item.effectApplied = false; return }

  const pts = victim.breakdown.find(e => e.code === driverCode)?.pts ?? 0
  victim.finalScore   -= pts
  item.effectApplied   = pts > 0
}

// ============================================================
// Étape 4 — Wild Cards (résolution parallèle via snapshot)
// Chaque vol est calculé sur le score ORIGINAL (pre-wildcard).
// ============================================================

export function resolveWildCards(
  wcItems: PlayedItem[],
  scores: Map<ScoreKey, SessionScore>,
): void {
  // Snapshot AVANT la boucle
  const snapshot = new Map<ScoreKey, number>()
  for (const [k, s] of scores) snapshot.set(k, s.finalScore)

  for (const wc of wcItems) {
    const payload = wc.payload as Extract<ItemPayload, { type: 'wild_card' }>
    const victimKey   = key(payload.targetUserId, payload.sessionType)
    const attackerKey = key(wc.userId, payload.sessionType)

    const stolen   = Math.floor((snapshot.get(victimKey) ?? 0) / 2)
    const victim   = scores.get(victimKey)
    const attacker = scores.get(attackerKey)

    if (victim)   victim.finalScore   -= stolen
    if (attacker) attacker.finalScore += stolen

    payload.pointsStolen = stolen
    wc.effectApplied     = true
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
  const { sessionType } = item.payload as Extract<ItemPayload, { type: 'double_points' }>
  const score = scores.get(key(item.userId, sessionType))
  if (score) { score.finalScore *= 2; item.effectApplied = true }
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
  const { driverCode } = item.payload as Extract<ItemPayload, { type: 'dnf_prediction' }>
  // DNS (position null, dnf false/undefined) = item wasted — seul dnf=true déclenche le bonus
  const confirmed = ctx.raceResults.get(driverCode)?.dnf === true
  if (confirmed) {
    const score = scores.get(key(item.userId, 'race'))
    if (score) score.finalScore += ITEM_BONUS_POINTS.dnf_prediction
  }
  item.effectApplied = confirmed
}

function resolveUnderdogTop5(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
): void {
  const { driverCode } = item.payload as Extract<ItemPayload, { type: 'underdog_top5' }>
  const qualPos = ctx.qualifyingResults.get(driverCode)?.position ?? null
  const racePos = ctx.raceResults.get(driverCode)?.position ?? null

  // DNS qualif (position null) = hors top 10 par défaut → éligible
  const isUnderdog  = qualPos === null || qualPos > 10
  const finishedTop5 = racePos !== null && racePos <= 5

  if (isUnderdog && finishedTop5) {
    const score = scores.get(key(item.userId, 'race'))
    if (score) score.finalScore += ITEM_BONUS_POINTS.underdog_top5
  }
  item.effectApplied = isUnderdog && finishedTop5
}

function resolveNoPointsTeam(
  item: PlayedItem,
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,
): void {
  const { constructorCode } = item.payload as Extract<ItemPayload, { type: 'no_points_team' }>
  const drivers  = ctx.constructorDrivers.get(constructorCode) ?? []
  const teamScored = drivers.some(code => {
    const pos = ctx.raceResults.get(code)?.position
    return pos !== null && pos !== undefined && pos <= 10
  })
  if (!teamScored) {
    const score = scores.get(key(item.userId, 'race'))
    if (score) score.finalScore += ITEM_BONUS_POINTS.no_points_team
  }
  item.effectApplied = !teamScored
}

// ============================================================
// Handler map (shield et wild_card dispatché séparément)
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
    items.filter(i => i.type === type && !i.wasShielded)

  resolveShields(items)
  active('block_driver').forEach(i => RESOLVERS.block_driver(i, scores, ctx))
  resolveWildCards(active('wild_card'), scores)
  active('double_points').forEach(i => RESOLVERS.double_points(i, scores, ctx))

  for (const type of ['dnf_prediction', 'underdog_top5', 'no_points_team'] as const) {
    active(type).forEach(i => RESOLVERS[type](i, scores, ctx))
  }

  return scores
}
