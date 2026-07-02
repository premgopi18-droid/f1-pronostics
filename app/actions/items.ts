'use server'

import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { insertPlayedItem } from '@/lib/data/items'
import { getCurrentGp } from '@/lib/data/current-gp'
import { ITEM_LOCK_PHASE } from '@/lib/items/catalog'
import { isPhaseLocked, type SessionTiming } from '@/lib/items/availability'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'
import {
  OFFENSIVE_ITEMS,
  toDBPayload,
  validatePayload,
  type BlockDriverPayload,
  type PlayItemInput,
  type WildCardPayload,
} from './items-payload'

// Session ciblée par l'item, ou null pour les items sans session (bouclier, bonus de prédiction).
function sessionTypeOf(input: PlayItemInput): SessionType | null {
  switch (input.itemType) {
    case 'block_driver':
    case 'wild_card':
    case 'double_points':
      return input.payload.sessionType as SessionType
    default:
      return null
  }
}

export type { PlayItemInput } from './items-payload'

export type PlayItemResult = { error: string } | { ok: true }

export async function playItemAction(
  gpId:     string,
  leagueId: string,
  input:    PlayItemInput,
): Promise<PlayItemResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Frontière de confiance : `input` vient du client, le typage TS ne garantit rien
  // au runtime. On valide la forme avant que validatePayload/toDBPayload ne déréférencent
  // `input.payload` (sinon un appel forgé — payload null/mal typé — lèverait un TypeError).
  if (
    typeof input !== 'object' || input === null ||
    typeof input.itemType !== 'string' ||
    typeof input.payload !== 'object' || input.payload === null
  ) {
    return { error: 'Requête invalide' }
  }

  const season = getCurrentSeason()

  // Items jouables uniquement sur le GP courant (product-specs §3.5) : on ne peut pas
  // jouer d'item sur un GP futur tant qu'un GP est en cours. Défense en profondeur —
  // l'UI verrouille déjà, mais l'action est un endpoint public.
  // `getCurrentGp` filtre déjà saison courante + non annulé : si l'id correspond, le GP
  // est valide, dans la bonne saison et non annulé → pas de 2ᵉ lecture de `grands_prix`.
  const currentGp = await getCurrentGp(season)
  if (!currentGp || currentGp.id !== gpId) {
    return { error: 'Les items ne sont jouables que sur le GP en cours' }
  }

  // Sessions scorées du GP (type + horaire) — base des deux verrous ci-dessous.
  // Essais libres (FP1-3) exclus : depuis #117/#122 la table `sessions` les contient
  // aussi, et sans ce filtre les paliers tomberaient sur l'EL1.
  const { data: rawSessions } = await supabase
    .from('sessions')
    .select('type, starts_at')
    .eq('gp_id', gpId)
    .in('type', SCOREABLE_SESSION_TYPES)
    .order('starts_at', { ascending: true })

  const scoredSessions: SessionTiming[] = (rawSessions ?? []).map((s) => ({
    type:     s.type as SessionType,
    startsAt: s.starts_at as string,
  }))
  if (scoredSessions.length === 0) return { error: 'Aucune session trouvée pour ce GP' }

  // Deadline dure selon le palier de l'item (product-specs §3.5 — deux paliers).
  const phase = ITEM_LOCK_PHASE[input.itemType]
  if (!phase) return { error: 'Type d\'item non supporté' }
  if (isPhaseLocked(phase, scoredSessions, Date.now())) {
    return { error: 'Deadline passée — cet item est verrouillé pour ce GP' }
  }

  // Gating par session : une session déjà démarrée n'est plus ciblable, même si la
  // deadline dure du palier n'est pas atteinte (cf. Bloquer un pilote joué le dimanche).
  const chosenSession = sessionTypeOf(input)
  if (chosenSession) {
    const session = scoredSessions.find((s) => s.type === chosenSession)
    if (!session) return { error: 'Session indisponible pour ce GP' }
    if (new Date(session.startsAt).getTime() <= Date.now()) {
      return { error: 'Session déjà démarrée — trop tard pour la cibler' }
    }
  }

  // Membership
  const { data: membership } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .eq('season', season)
    .maybeSingle()

  if (!membership) return { error: 'Tu n\'es pas membre de cette ligue' }

  // 1 item par GP par ligue par utilisateur
  const { data: alreadyPlayed } = await supabase
    .from('items_played')
    .select('id')
    .eq('user_id', user.id)
    .eq('gp_id', gpId)
    .eq('league_id', leagueId)
    .maybeSingle()

  if (alreadyPlayed) return { error: 'Tu as déjà joué un item ce week-end dans cette ligue' }

  // uses_remaining > 0
  const { data: itemRow } = await supabase
    .from('user_items')
    .select('uses_remaining')
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('item_type', input.itemType)
    .maybeSingle()

  if (!itemRow || (itemRow.uses_remaining as number) <= 0) {
    return { error: 'Item épuisé pour cette saison' }
  }

  // Validations payload selon le type
  const validationError = validatePayload(input)
  if (validationError) return { error: validationError }

  // Pour les items offensifs : la cible doit être un autre membre de la ligue
  if (OFFENSIVE_ITEMS.has(input.itemType)) {
    const offensivePayload = input.payload as BlockDriverPayload | WildCardPayload
    if (offensivePayload.targetUserId === user.id) {
      return { error: 'Tu ne peux pas te cibler toi-même' }
    }
    const { data: targetMember } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId)
      .eq('user_id', offensivePayload.targetUserId)
      .eq('season', season)
      .maybeSingle()

    if (!targetMember) return { error: 'La cible n\'est pas membre de cette ligue' }
  }

  // Conversion payload TS (camelCase) → DB (snake_case)
  const dbPayload = toDBPayload(input)

  try {
    await insertPlayedItem(user.id, leagueId, gpId, season, input.itemType, dbPayload)
    return { ok: true }
  } catch (error) {
    // Backstop des races rares (les pré-checks couvrent les cas courants) : la RPC rejette
    // un PostgrestError — exhaustion (P0001) ou double-play concurrent (unique_violation 23505).
    const code = (error as { code?: string }).code
    if (code === 'P0001') return { error: 'Item épuisé pour cette saison' }
    if (code === '23505') return { error: 'Tu as déjà joué un item ce week-end dans cette ligue' }
    return { error: 'Erreur inattendue' }
  }
}
