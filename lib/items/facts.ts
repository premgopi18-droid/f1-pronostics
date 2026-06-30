import { t } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { itemEmoji, itemName } from '@/lib/items/catalog'
import { formatSignedDelta, type DeltaKind } from '@/lib/scoring/delta'
import { ITEM_RESOLUTION_ORDER } from '@/lib/scoring/resolve-items'
import { sessionLabel } from '@/lib/scoring/session-label'
import type { SessionType } from '@/lib/scoring/types'

/**
 * Construit le récap « Faits marquants du GP » à partir des items résolus (issue #151).
 * Fonction pure : prend les items résolus + l'identité des joueurs, renvoie des « faits »
 * prêts à rendre. Ordre de résolution strict de la spec §3.5.
 */

export interface ResolvedItem {
  userId:            string
  itemType:          string
  payload:           Record<string, unknown>   // JSON DB (snake_case)
  wasShielded:       boolean
  pointsDeltaActor:  number | null
  pointsDeltaTarget: number | null
}

export interface PlayerIdentity {
  pseudo: string
  color:  string
}

export interface Fact {
  key:          string
  emoji:        string
  actorPseudo:  string
  actorColor:   string
  verb:         string
  object:       string        // nom d'item ou code pilote (block)
  targetPseudo?: string
  targetColor?:  string
  prep?:        string
  sessionLabel?: string
  deltaText?:   string
  deltaKind:    DeltaKind
  tag?:         string
  chain:        string[]
}

// Ordre d'affichage = ordre de résolution (source unique : resolve-items).
function orderIndex(itemType: string): number {
  const index = (ITEM_RESOLUTION_ORDER as readonly string[]).indexOf(itemType)
  return index < 0 ? ITEM_RESOLUTION_ORDER.length : index
}

function chain(key: string, vars: Record<string, string | number> = {}): string {
  return t(`gpResults.${key}` as TranslationKey, vars)
}

export function buildGPFacts(
  items:    ResolvedItem[],
  identity: Map<string, PlayerIdentity>,
): Fact[] {
  const unknown: PlayerIdentity = { pseudo: '?', color: '#52525b' }
  const who = (userId: string): PlayerIdentity => identity.get(userId) ?? unknown

  // Nombre d'attaques neutralisées par le bouclier de chaque joueur.
  const shieldedAttacksByTarget = new Map<string, number>()
  for (const item of items) {
    if ((item.itemType === 'block_driver' || item.itemType === 'wild_card') && item.wasShielded) {
      const target = item.payload.target_user_id as string | undefined
      if (target) shieldedAttacksByTarget.set(target, (shieldedAttacksByTarget.get(target) ?? 0) + 1)
    }
  }

  const facts: Fact[] = []

  // Ordre de résolution spec §3.5.
  const ordered = [...items].sort((a, b) => orderIndex(a.itemType) - orderIndex(b.itemType))

  for (const item of ordered) {
    const actor   = who(item.userId)
    const emoji   = itemEmoji(item.itemType)
    const baseKey = `${item.userId}-${item.itemType}`

    switch (item.itemType) {
      case 'shield': {
        const blocked = shieldedAttacksByTarget.get(item.userId) ?? 0
        facts.push({
          key: baseKey, emoji,
          actorPseudo: actor.pseudo, actorColor: actor.color,
          verb: t('gpResults.factPlays'), object: itemName('shield'),
          deltaKind: 'nil',
          chain: [blocked > 0 ? chain('chainShieldBlocked', { pts: blocked }) : chain('chainShieldUnused')],
        })
        break
      }

      case 'block_driver': {
        const targetId = item.payload.target_user_id as string
        const target   = who(targetId)
        const driver   = item.payload.driver_code as string
        const sLabel   = sessionLabel(item.payload.session_type as SessionType)
        const loss     = item.pointsDeltaTarget ?? 0

        const common = {
          key: baseKey, emoji,
          actorPseudo: actor.pseudo, actorColor: actor.color,
          verb: t('gpResults.factBlocks'), object: driver,
          prep: t('gpResults.factVs'), targetPseudo: target.pseudo, targetColor: target.color,
          sessionLabel: sLabel,
        }

        if (item.wasShielded) {
          facts.push({
            ...common, deltaKind: 'nil', tag: t('gpResults.factCancelled'),
            chain: [
              chain('chainBlockShielded', { target: target.pseudo }),
              chain('chainBlockCancelled', { driver }),
            ],
          })
        } else if (loss < 0) {
          facts.push({
            ...common, deltaText: formatSignedDelta(loss), deltaKind: 'neg',
            chain: [chain('chainBlockRemoved', { driver, session: sLabel ?? '', pts: Math.abs(loss) })],
          })
        } else {
          facts.push({
            ...common, deltaText: '0', deltaKind: 'nil',
            chain: [chain('chainBlockNoPoints', { driver })],
          })
        }
        break
      }

      case 'wild_card': {
        const targetId = item.payload.target_user_id as string
        const target   = who(targetId)
        const sLabel   = sessionLabel(item.payload.session_type as SessionType)
        const stolen   = (item.payload.points_stolen as number | undefined) ?? item.pointsDeltaActor ?? 0

        const common = {
          key: baseKey, emoji,
          actorPseudo: actor.pseudo, actorColor: actor.color,
          verb: t('gpResults.factPlays'), object: itemName('wild_card'),
          prep: t('gpResults.factOn'), targetPseudo: target.pseudo, targetColor: target.color,
          sessionLabel: sLabel,
        }

        if (item.wasShielded) {
          facts.push({
            ...common, deltaKind: 'nil', tag: t('gpResults.factCancelled'),
            chain: [
              chain('chainBlockShielded', { target: target.pseudo }),
              chain('chainWildCancelled'),
            ],
          })
        } else {
          facts.push({
            ...common,
            deltaText: stolen > 0 ? formatSignedDelta(stolen) : undefined,
            deltaKind: stolen > 0 ? 'pos' : 'nil',
            chain: [
              chain('chainWildSteal', { actor: actor.pseudo, session: sLabel ?? '', target: target.pseudo }),
              chain('chainWildTransfer', { pts: stolen, target: target.pseudo, actor: actor.pseudo }),
            ],
          })
        }
        break
      }

      case 'double_points': {
        const sLabel = sessionLabel(item.payload.session_type as SessionType)
        const gain   = item.pointsDeltaActor ?? 0
        facts.push({
          key: baseKey, emoji,
          actorPseudo: actor.pseudo, actorColor: actor.color,
          verb: t('gpResults.factPlays'), object: itemName('double_points'),
          sessionLabel: sLabel,
          deltaText: gain > 0 ? formatSignedDelta(gain) : undefined,
          deltaKind: gain > 0 ? 'pos' : 'nil',
          chain: [gain > 0
            ? chain('chainDoubleApplied', { session: sLabel ?? '', pts: gain })
            : chain('chainDoubleNoEffect')],
        })
        break
      }

      case 'dnf_prediction':
      case 'underdog_top5':
      case 'no_points_team': {
        const gain = item.pointsDeltaActor ?? 0
        facts.push({
          key: baseKey, emoji,
          actorPseudo: actor.pseudo, actorColor: actor.color,
          verb: t('gpResults.factPlays'), object: itemName(item.itemType),
          deltaText: gain > 0 ? formatSignedDelta(gain) : undefined,
          deltaKind: gain > 0 ? 'pos' : 'nil',
          chain: [gain > 0
            ? chain('chainBonusApplied', { pts: gain })
            : chain('chainBonusNoEffect')],
        })
        break
      }

      // fia_penalty + items saison : non concernés (jamais résolus ici).
      default:
        break
    }
  }

  return facts
}
