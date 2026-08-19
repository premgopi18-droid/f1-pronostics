import { createServiceClient } from '@/lib/supabase'

// Couche data de la détection de changement de line-up (#205) — I/O uniquement,
// la logique de diff/formatage vit dans lib/data/lineup-changes.ts (pur, testé).
// Écrit exclusivement par le cron de sync (service role) ; lecture publique.

/**
 * Upsert du line-up observé d'un GP (code pilote → libellé écurie OpenF1).
 * Re-synchronisé à chaque passage du cron jusqu'à la course. Un pilote dont
 * l'écurie CHANGE entre deux passages (2ᵉ remplacement du week-end) voit son
 * notified_at remis à null → il redevient éligible à une notification.
 * Les pilotes disparus du line-up frais sont conservés (ils ont roulé ce
 * week-end — utile comme baseline du GP suivant), pas de purge.
 */
export async function upsertGPLineup(
  gpId: string,
  season: number,
  lineup: Map<string, string>,
): Promise<void> {
  if (lineup.size === 0) return
  const supabase = createServiceClient()

  // Résolution code → UUID pour les pilotes de cette saison
  const codes = Array.from(lineup.keys())
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, code')
    .eq('season', season)
    .in('code', codes)

  if (driversError) throw driversError

  const codeToId = new Map((drivers ?? []).map((d) => [d.code, d.id]))

  // Réserviste vu par OpenF1 mais pas encore listé par Jolpica : filtré plus
  // bas, le cas se résorbe dès que Jolpica l'ajoute — mais on le trace pour
  // que le trou soit observable dans les logs du cron.
  const unknownCodes = codes.filter((code) => !codeToId.has(code))
  if (unknownCodes.length > 0) {
    console.warn(
      `upsertGPLineup : pilotes absents de drivers pour la saison ${season} — ${unknownCodes.join(', ')}`,
    )
  }

  // Lignes existantes : préserver notified_at si l'écurie n'a pas bougé,
  // le remettre à null sinon (le payload d'un upsert doit être homogène,
  // on renseigne donc la colonne pour toutes les lignes).
  const { data: existing, error: existingError } = await supabase
    .from('gp_lineups')
    .select('driver_id, team_name, notified_at')
    .eq('gp_id', gpId)

  if (existingError) throw existingError

  const existingByDriverId = new Map((existing ?? []).map((row) => [row.driver_id, row]))

  const rows = Array.from(lineup.entries())
    .filter(([code]) => codeToId.has(code))
    .map(([code, teamName]) => {
      const driverId = codeToId.get(code)!
      const previous = existingByDriverId.get(driverId)
      const teamUnchanged = previous?.team_name === teamName
      return {
        gp_id:       gpId,
        season,
        driver_id:   driverId,
        team_name:   teamName,
        notified_at: teamUnchanged ? (previous?.notified_at ?? null) : null,
      }
    })

  // Rien de neuf (aucun pilote ajouté, aucune écurie modifiée) : pas d'écriture.
  // La fonction tourne à chaque passage du cron pendant tout le week-end — cet
  // early-return évite ~20 lignes réécrites à vide toutes les 10 minutes.
  const hasChanges = rows.some((row) => {
    const previous = existingByDriverId.get(row.driver_id)
    return !previous || previous.team_name !== row.team_name
  })
  if (!hasChanges) return

  const { error } = await supabase
    .from('gp_lineups')
    .upsert(rows, { onConflict: 'gp_id,driver_id' })

  if (error) throw error
}

/**
 * Line-up de référence : celui du dernier GP disputé avant `beforeRound` qui a
 * des lignes en base. On regarde quelques rounds en arrière (GP annulé ou sans
 * données OpenF1) ; Map vide si aucune baseline — le diff ne notifie alors pas.
 */
const BASELINE_LOOKBACK_ROUNDS = 3

export async function getPreviousGPLineup(
  season: number,
  beforeRound: number,
): Promise<Map<string, string>> {
  const supabase = createServiceClient()

  const { data: candidates, error: candidatesError } = await supabase
    .from('grands_prix')
    .select('id, round')
    .eq('season', season)
    .lt('round', beforeRound)
    .order('round', { ascending: false })
    .limit(BASELINE_LOOKBACK_ROUNDS)

  if (candidatesError) throw candidatesError
  if (!candidates?.length) return new Map()

  const { data: rows, error: rowsError } = await supabase
    .from('gp_lineups')
    .select('gp_id, team_name, drivers!driver_id(code)')
    .in('gp_id', candidates.map((gp) => gp.id))

  if (rowsError) throw rowsError

  // Rows du candidat le plus récent qui en possède (candidates est trié desc).
  for (const candidate of candidates) {
    const lineup = new Map<string, string>()
    for (const row of rows ?? []) {
      if (row.gp_id === candidate.id && row.drivers) {
        lineup.set(row.drivers.code, row.team_name)
      }
    }
    if (lineup.size > 0) return lineup
  }
  return new Map()
}

/**
 * Claim atomique des notifications de changement pour un GP : pose notified_at
 * sur les pilotes donnés seulement si encore null (même patron que
 * claimSessionDeadlineNotification — marquer avant d'envoyer, dédup inter-run
 * garantie même si deux crons se chevauchent). Renvoie les pilotes que CET
 * appel a revendiqués, avec leur nom de famille pour le corps du push.
 */
export async function claimLineupChangeNotifications(
  gpId: string,
  season: number,
  driverCodes: string[],
): Promise<{ code: string; lastName: string }[]> {
  if (driverCodes.length === 0) return []
  const supabase = createServiceClient()

  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, code, last_name')
    .eq('season', season)
    .in('code', driverCodes)

  if (driversError) throw driversError
  if (!drivers?.length) return []

  const { data: claimed, error: claimError } = await supabase
    .from('gp_lineups')
    .update({ notified_at: new Date().toISOString() })
    .eq('gp_id', gpId)
    .in('driver_id', drivers.map((d) => d.id))
    .is('notified_at', null)
    .select('driver_id')

  if (claimError) throw claimError

  const claimedIds = new Set((claimed ?? []).map((row) => row.driver_id))
  return drivers
    .filter((d) => claimedIds.has(d.id))
    .map((d) => ({ code: d.code, lastName: d.last_name }))
}
