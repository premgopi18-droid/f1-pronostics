import { revalidatePath } from 'next/cache'

/**
 * Purge le cache client du router après une mutation utilisateur (#243).
 *
 * `experimental.staleTimes.dynamic` (next.config.ts) garde les pages dynamiques
 * 30 s en cache côté client pour que revenir sur un onglet soit instantané. En
 * contrepartie, TOUTE Server Action qui modifie une donnée affichée doit purger ce
 * cache, sinon l'utilisateur peut revoir l'état d'avant sa mutation. Granularité
 * volontairement grossière (tout le cache) : une mutation touche souvent plusieurs
 * écrans (Home, Ligue, Mes Pronos…) et l'app est petite — plus sûr que de lister
 * les chemins un à un.
 */
export function revalidateAfterMutation(): void {
  revalidatePath('/', 'layout')
}
