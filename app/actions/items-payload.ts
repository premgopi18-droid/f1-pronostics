// Logique pure du slice items : types de payload, validation et mapping DB.
// Volontairement SANS 'use server' — ces fonctions synchrones sont importées par
// la server action `playItemAction` et testées en isolation (cf. items-payload.test.ts).

// Payloads typés côté serveur — stricts, jamais de champ superflu
export type ShieldPayload       = Record<string, never>
export type BlockDriverPayload  = { targetUserId: string; sessionType: string; driverCode: string }
export type WildCardPayload     = { targetUserId: string; sessionType: string }
export type DoublePointsPayload = { sessionType: string }
export type DriverCodePayload   = { driverCode: string }
export type ConstructorPayload  = { constructorCode: string }

export type PlayItemInput =
  | { itemType: 'shield';          payload: ShieldPayload }
  | { itemType: 'block_driver';    payload: BlockDriverPayload }
  | { itemType: 'wild_card';       payload: WildCardPayload }
  | { itemType: 'double_points';   payload: DoublePointsPayload }
  | { itemType: 'dnf_prediction';  payload: DriverCodePayload }
  | { itemType: 'underdog_top5';   payload: DriverCodePayload }
  | { itemType: 'no_points_team';  payload: ConstructorPayload }

export const OFFENSIVE_ITEMS = new Set(['block_driver', 'wild_card'])
export const SESSION_TYPES   = new Set(['qualifying', 'race', 'sprint_qualifying', 'sprint_race'])

// Sessions ciblables PAR item (cf. product-specs §220/238/239) :
// - block_driver : les 4 sessions (sprint inclus) — « Sprint Qualifying, Sprint Race, Qualifications ou Course »
// - wild_card / double_points : course ou qualifications uniquement
export const ALLOWED_SESSIONS: Record<string, Set<string>> = {
  block_driver:  SESSION_TYPES,
  wild_card:     new Set(['qualifying', 'race']),
  double_points: new Set(['qualifying', 'race']),
}

export function validatePayload(input: PlayItemInput): string | null {
  switch (input.itemType) {
    case 'shield':
      return null

    case 'block_driver': {
      const p = input.payload
      if (!p.targetUserId)                                  return 'Cible requise'
      if (!p.driverCode)                                    return 'Pilote requis'
      if (!ALLOWED_SESSIONS.block_driver.has(p.sessionType)) return 'Session invalide'
      return null
    }

    case 'wild_card': {
      const p = input.payload
      if (!p.targetUserId)                                return 'Cible requise'
      if (!ALLOWED_SESSIONS.wild_card.has(p.sessionType)) return 'Session invalide'
      return null
    }

    case 'double_points': {
      const { sessionType } = input.payload
      if (!ALLOWED_SESSIONS.double_points.has(sessionType)) return 'Session invalide'
      return null
    }

    case 'dnf_prediction':
    case 'underdog_top5': {
      if (!input.payload.driverCode)          return 'Pilote requis'
      return null
    }

    case 'no_points_team': {
      if (!input.payload.constructorCode)     return 'Écurie requise'
      return null
    }

    default:
      return 'Type d\'item non supporté'
  }
}

// Toutes les valeurs des payloads DB sont des chaînes (codes pilotes/écuries,
// ids utilisateurs, types de session) — le type précis évite tout cast vers Json.
export function toDBPayload(input: PlayItemInput): Record<string, string> {
  switch (input.itemType) {
    case 'shield':
      return {}

    case 'block_driver': {
      const p = input.payload
      return { target_user_id: p.targetUserId, session_type: p.sessionType, driver_code: p.driverCode }
    }

    case 'wild_card': {
      const p = input.payload
      return { target_user_id: p.targetUserId, session_type: p.sessionType }
    }

    case 'double_points':
      return { session_type: input.payload.sessionType }

    case 'dnf_prediction':
    case 'underdog_top5':
      return { driver_code: input.payload.driverCode }

    case 'no_points_team':
      return { constructor_code: input.payload.constructorCode }
  }
}
