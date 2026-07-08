import { t, type TranslationKey } from '@/lib/i18n'

// Codes d'erreur des Server Actions (i18n approche A) : les actions retournent
// des codes typés, le CLIENT les traduit via `translateActionError`. La copy
// française vit dans `lib/i18n/fr.ts` (section `actionErrors`) — jamais dans
// les actions. Le test d'exhaustivité (errors.test.ts) garantit qu'aucun code
// n'atteint l'utilisateur sans traduction.
export const ACTION_ERROR_CODES = [
  // Transverses
  'notAuthenticated',
  'invalidRequest',
  'unexpected',
  'serverError',

  // Items GP (playItemAction + validatePayload)
  'itemOnlyCurrentGp',
  'noSessionsForGp',
  'unsupportedItemType',
  'itemDeadlinePassed',
  'sessionUnavailable',
  'sessionAlreadyStarted',
  'notLeagueMember',
  'itemAlreadyPlayedThisWeekend',
  'itemExhausted',
  'cannotTargetSelf',
  'targetNotLeagueMember',
  'targetRequired',
  'driverRequired',
  'constructorRequired',
  'invalidSession',

  // Administration de ligue
  'adminOnly',
  'updateFailed',
  'cannotTransferToSelf',
  'transferFailed',
  'memberNotFound',
  'regenerateFailed',
  'inviteCodeGenerationFailed',

  // Pronostics GP
  'sessionNotFound',
  'sessionLocked',
  'tooManyDrivers',
  'duplicateDriver',
  'unknownDriver',
  'fastestLapRaceOnly',

  // Pronostics et items saison
  'seasonPredictionsLocked',
  'seasonPredictionsNotLockedYet',
  'seasonItemsLocked',
  'seasonPredictionRequiredFirst',
  'entriesCountRequired',
  'invalidCode',
  'duplicateEntries',
  'invalidPositions',
] as const

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number]

/** Variables d'interpolation des messages paramétrés (ex. `{count}`, `{code}`). */
export type ActionErrorVars = Record<string, string | number>

/** Forme commune d'un échec de Server Action. */
export type ActionFailure = { error: ActionErrorCode; errorVars?: ActionErrorVars }

const UNEXPECTED_KEY: TranslationKey = 'actionErrors.unexpected'

/**
 * Traduit un code d'erreur d'action côté client. Fallback sur le message
 * générique si le code est inconnu (robustesse pendant un déploiement où un
 * vieux client reçoit un code plus récent que son bundle).
 *
 * `ActionErrorCode | (string & {})` : autocomplete + détection de typo sur les
 * codes connus, tout en acceptant une string arbitraire (le cas fallback).
 */
export function translateActionError(
  code: ActionErrorCode | (string & {}),
  vars?: ActionErrorVars,
): string {
  const isKnownCode = (ACTION_ERROR_CODES as readonly string[]).includes(code)
  if (!isKnownCode) return t(UNEXPECTED_KEY)
  return t(`actionErrors.${code}` as TranslationKey, vars)
}
