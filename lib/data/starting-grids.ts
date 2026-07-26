import { createClient, createServiceClient } from '@/lib/supabase'

// ── Lecture (client RLS — la table est en lecture publique) ────────────────

/**
 * Grilles de départ connues pour un lot de sessions course.
 * Retourne sessionId → codes pilotes ordonnés par position de grille.
 * Les sessions sans grille importée sont simplement absentes de la Map.
 */
export async function getStartingGrids(
  sessionIds: string[],
): Promise<Map<string, string[]>> {
  if (sessionIds.length === 0) return new Map()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('starting_grids')
    .select('session_id, position, drivers!driver_id(code)')
    .in('session_id', sessionIds)
    .order('position', { ascending: true })

  if (error) throw error

  const grids = new Map<string, string[]>()
  for (const row of data ?? []) {
    if (!row.drivers) continue
    const codes = grids.get(row.session_id) ?? []
    codes.push(row.drivers.code)
    grids.set(row.session_id, codes)
  }
  return grids
}

// ── Écriture (cron de sync, service role) ──────────────────────────────────

/**
 * Upsert de la grille d'une session course (code pilote → position).
 * Re-synchronisée à chaque passage du cron jusqu'au départ, pour capter les
 * pénalités tardives — l'upsert met à jour les positions existantes, puis les
 * lignes des pilotes sortis de la grille (forfait, grille republiée) sont
 * supprimées pour ne jamais servir un ordre périmé au pré-remplissage.
 */
export async function upsertStartingGrid(
  sessionId: string,
  season: number,
  grid: Map<string, number>,
): Promise<void> {
  const supabase = createServiceClient()

  // Résolution code → UUID pour les pilotes de cette saison
  const codes = Array.from(grid.keys())
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, code')
    .eq('season', season)
    .in('code', codes)

  if (driversError) throw driversError

  const codeToId = new Map((drivers ?? []).map((d) => [d.code, d.id]))

  const rows = Array.from(grid.entries())
    .filter(([code]) => codeToId.has(code))
    .map(([code, position]) => ({
      session_id: sessionId,
      season,
      driver_id:  codeToId.get(code)!,
      position,
    }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('starting_grids')
    .upsert(rows, { onConflict: 'session_id,driver_id' })

  if (error) throw error

  // Purge des lignes hors grille fraîche (upsert d'abord, delete ensuite :
  // pas de fenêtre où la grille serait absente pour un lecteur concurrent).
  const freshDriverIds = rows.map((row) => row.driver_id)
  const { error: staleError } = await supabase
    .from('starting_grids')
    .delete()
    .eq('session_id', sessionId)
    .not('driver_id', 'in', `(${freshDriverIds.join(',')})`)

  if (staleError) throw staleError
}
