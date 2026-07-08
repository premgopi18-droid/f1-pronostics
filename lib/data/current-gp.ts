import { createServiceClient } from '@/lib/supabase'
import { deriveCurrentGpView, type CurrentGpView } from '@/lib/home-phase'

/**
 * GP courant = premier GP non annulé dont le scoring n'est pas finalisé
 * (`scoring_finalized_at IS NULL`, plus petit `round`). Source unique réutilisée par
 * la Home et par le slice items (règle « items jouables uniquement sur le GP courant »,
 * cf. product-specs §3.5). `null` en fin de saison (tout finalisé).
 */
export type CurrentGp = {
  id:              string
  name:            string
  country:         string
  round:           number
  weekendStartsAt: string | null
}

export async function getCurrentGp(season: number): Promise<CurrentGp | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name, country, round, weekend_starts_at')
    .eq('season', season)
    .eq('is_cancelled', false)
    .is('scoring_finalized_at', null)
    .order('round', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id:              data.id,
    name:            data.name,
    country:         data.country,
    round:           data.round,
    weekendStartsAt: data.weekend_starts_at,
  }
}

export type CurrentGpWithView = { gp: CurrentGp; view: CurrentGpView }

/**
 * GP courant + sa vue Home (phase, sessions de la card, `hasResults`) en UNE seule
 * requête (jointure `grands_prix → sessions`) — supprime la cascade GP puis sessions
 * de la Home (#183). `Date.now()` est lu ici (fonction de données, hors render React) ;
 * la dérivation est déléguée au helper pur `deriveCurrentGpView`.
 *
 * ⚠️ Mêmes filtres que `getCurrentGp` ci-dessus (définition du « GP courant »,
 * product-specs §3.5) — modifier les deux ensemble.
 */
export async function getCurrentGpWithView(season: number): Promise<CurrentGpWithView | null> {
  const supabase = createServiceClient()
  const nowMs = Date.now()

  // Toutes les sessions (EL comprises) : le helper sépare ce qui sert à
  // `hasResults` (tout) de ce qui sert à la phase / la card (sessions scorées).
  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name, country, round, weekend_starts_at, sessions(type, starts_at, results_confirmed_at)')
    .eq('season', season)
    .eq('is_cancelled', false)
    .is('scoring_finalized_at', null)
    .order('round', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // L'embed PostgREST ne garantit pas l'ordre — deriveCurrentGpView et la card
  // week-end attendent les sessions triées chronologiquement. Tri numérique sur le
  // timestamp (pas lexicographique) : insensible au format d'offset renvoyé.
  const sessions = [...data.sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )

  return {
    gp: {
      id:              data.id,
      name:            data.name,
      country:         data.country,
      round:           data.round,
      weekendStartsAt: data.weekend_starts_at,
    },
    view: deriveCurrentGpView(
      nowMs,
      data.weekend_starts_at,
      sessions.map((s) => ({
        type: s.type,
        startsAt: s.starts_at,
        resultsConfirmedAt: s.results_confirmed_at,
      })),
    ),
  }
}
