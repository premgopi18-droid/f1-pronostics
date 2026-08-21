import type { TranslationKey } from '@/lib/i18n'
import type { SessionType } from '@/lib/scoring/types'

/**
 * Mappings uniques SessionType → clé de libellé (#221). Remplace les trois jeux
 * qui coexistaient (`home.session.*`, `predict.tab.*`, labels en dur du
 * play-item-form) — tout site qui affiche un nom de session passe par ici.
 */

/** Libellés longs — « Qualifications », listes et cards avec de la place. */
export const SESSION_LABEL_KEY: Record<SessionType, TranslationKey> = {
  qualifying: 'session.long.qualifying',
  race: 'session.long.race',
  sprint_qualifying: 'session.long.sprint_qualifying',
  sprint_race: 'session.long.sprint_race',
}

/** Libellés courts — « Qualifs », tabs et colonnes étroites. */
export const SESSION_SHORT_LABEL_KEY: Record<SessionType, TranslationKey> = {
  qualifying: 'session.short.qualifying',
  race: 'session.short.race',
  sprint_qualifying: 'session.short.sprint_qualifying',
  sprint_race: 'session.short.sprint_race',
}
