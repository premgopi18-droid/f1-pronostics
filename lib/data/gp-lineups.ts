import { createServiceClient } from '@/lib/supabase'
import { constructorCodeFromOpenF1TeamName } from '@/lib/f1/team-names'
import { isSeatTaken, selectDriversToEnroll } from '@/lib/data/lineup-changes'
import type { SessionLineupDriver } from '@/lib/f1/openf1'

// Couche data de la détection de changement de line-up (#205) — I/O uniquement,
// la logique de diff/formatage vit dans lib/data/lineup-changes.ts (pur, testé).
// Écrit exclusivement par le cron de sync (service role) ; lecture publique.

/**
 * Inscrit dans `drivers` les pilotes d'un line-up qui fait foi (cf.
 * isLineupSessionAuthoritative) et qu'aucune source n'a encore créés (#255) :
 * remplaçant que Jolpica liste sans trigramme (Hirakawa, Mexique 2026) ou pas
 * encore du tout. Trigramme, numéro et nom viennent d'OpenF1 ; l'écurie du
 * line-up sert de rattachement saison (le mapping standings Jolpica la
 * remplacera s'il marque des points). Jamais d'écrasement : un pilote déjà
 * présent (créé par Jolpica entre-temps) reste tel quel — et si Jolpica lui
 * donne plus tard le même trigramme, son upsert retombe sur cette ligne.
 * Renvoie les codes inscrits.
 */
export async function enrollReplacementDrivers(
  season: number,
  lineup: SessionLineupDriver[],
): Promise<string[]> {
  if (lineup.length === 0) return []
  const supabase = createServiceClient()

  // Tous les pilotes de la saison (une vingtaine) : les numéros connus servent
  // de garde-fou anti-doublon, pas seulement les codes du line-up.
  const { data: known, error: knownError } = await supabase
    .from('drivers')
    .select('code, number')
    .eq('season', season)

  if (knownError) throw knownError

  const toEnroll = selectDriversToEnroll(lineup, {
    codes:   new Set((known ?? []).map((driver) => driver.code)),
    numbers: new Set((known ?? []).flatMap((driver) => driver.number != null ? [driver.number] : [])),
  })
  if (toEnroll.length === 0) return []

  const constructorCodes = [...new Set(
    toEnroll
      .map((driver) => constructorCodeFromOpenF1TeamName(driver.teamName))
      .filter((code): code is string => code !== null),
  )]
  const { data: constructors, error: constructorsError } = constructorCodes.length > 0
    ? await supabase.from('constructors').select('id, code').eq('season', season).in('code', constructorCodes)
    : { data: [], error: null }

  if (constructorsError) throw constructorsError

  const constructorIdByCode = new Map((constructors ?? []).map((constructor) => [constructor.code, constructor.id]))

  const { data: inserted, error: insertError } = await supabase
    .from('drivers')
    .upsert(
      toEnroll.map((driver) => {
        const constructorCode = constructorCodeFromOpenF1TeamName(driver.teamName)
        return {
          season,
          code:           driver.driverCode,
          first_name:     driver.firstName!,
          last_name:      driver.lastName!,
          number:         driver.driverNumber,
          constructor_id: constructorCode ? (constructorIdByCode.get(constructorCode) ?? null) : null,
        }
      }),
      { onConflict: 'season,code', ignoreDuplicates: true },
    )
    .select('code')

  if (insertError) throw insertError

  const enrolledCodes = (inserted ?? []).map((driver) => driver.code)
  if (enrolledCodes.length > 0) {
    console.warn(`enrollReplacementDrivers : pilotes inscrits depuis OpenF1 pour la saison ${season} — ${enrolledCodes.join(', ')}`)
  }
  return enrolledCodes
}

/**
 * Upsert du line-up observé d'un GP (code pilote → libellé écurie OpenF1).
 * Re-synchronisé à chaque passage du cron jusqu'à la course. Un pilote dont
 * l'écurie CHANGE entre deux passages (2ᵉ remplacement du week-end) voit son
 * notified_at remis à null → il redevient éligible à une notification.
 * Les pilotes disparus du line-up frais sont conservés (ils ont roulé ce
 * week-end — utile comme baseline du GP suivant), pas de purge.
 *
 * `fromTrustedSession` (#211) : le line-up vient d'une session « fiable »
 * (cf. isLineupSessionTrusted) — les pilotes présents reçoivent observed_at :
 * ils ont réellement roulé ce week-end, par opposition au pré-seed nominal du
 * jeudi. Sert au badge « absent du week-end ? » et à l'écurie affichée dans la
 * liste de pronos.
 *
 * `authoritative` (#255, cf. isLineupSessionAuthoritative) : le line-up fait
 * foi sur les engagés — un pilote déjà observé, ABSENT de ce line-up, dont le
 * baquet est occupé par un autre a été remplacé en cours de week-end (Ocon,
 * Mexique 2026 : vu en EL2, remplacé dès l'EL3) → son observed_at est remis à
 * null, le badge réapparaît. Jamais sur l'EL1 : les titulaires remplacés par
 * un rookie y sont absents sans l'être du GP.
 */
export async function upsertGPLineup(
  gpId: string,
  season: number,
  lineup: Map<string, string>,
  fromTrustedSession: boolean,
  authoritative: boolean,
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
    .select('driver_id, team_name, notified_at, observed_at')
    .eq('gp_id', gpId)

  if (existingError) throw existingError

  const existingByDriverId = new Map((existing ?? []).map((row) => [row.driver_id, row]))
  const observationTime = new Date().toISOString()

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
        // « A été vu en piste ce week-end » : seul un line-up qui fait foi le
        // retire, s'il ne contient plus le pilote (requête plus bas).
        observed_at: previous?.observed_at ?? (fromTrustedSession ? observationTime : null),
      }
    })

  // Pilotes observés, absents d'un line-up qui fait foi ET dont le baquet est
  // occupé (isSeatTaken) : remplacés en cours de week-end. Une absence seule ne
  // suffit pas — OpenF1 omet parfois un pilote qui a couru. Aucune écriture
  // dans le cas nominal.
  if (authoritative) {
    const presentDriverIds = new Set(rows.map((row) => row.driver_id))
    const replacedDriverIds = (existing ?? [])
      .filter((row) =>
        row.observed_at !== null
        && !presentDriverIds.has(row.driver_id)
        && isSeatTaken(row.team_name, lineup),
      )
      .map((row) => row.driver_id)

    if (replacedDriverIds.length > 0) {
      const { error: clearError } = await supabase
        .from('gp_lineups')
        .update({ observed_at: null })
        .eq('gp_id', gpId)
        .in('driver_id', replacedDriverIds)

      if (clearError) throw clearError
    }
  }

  // Rien de neuf (aucun pilote ajouté, aucune écurie modifiée, aucune première
  // observation fiable) : pas d'écriture. La fonction tourne à chaque passage
  // du cron pendant tout le week-end — cet early-return évite ~20 lignes
  // réécrites à vide toutes les 10 minutes.
  const hasChanges = rows.some((row) => {
    const previous = existingByDriverId.get(row.driver_id)
    return !previous
      || previous.team_name !== row.team_name
      || (previous.observed_at === null && row.observed_at !== null)
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
    .select('gp_id, team_name, observed_at, drivers!driver_id(code)')
    .in('gp_id', candidates.map((gp) => gp.id))

  if (rowsError) throw rowsError

  // Rows du candidat le plus récent qui en possède (candidates est trié desc).
  // Un pilote non observé dont le baquet était occupé par deux pilotes observés
  // est exclu de la baseline (#255) : titulaire remplacé en cours de week-end,
  // son retour au GP suivant est donc un changement notifié (« Ocon remplace
  // Hirakawa »). Même garde-fou que le retrait d'observation (isSeatTaken) :
  // un pilote simplement omis par OpenF1, ou un GP sans aucune observation
  // (avant #211), garde toutes ses lignes, comme avant.
  for (const candidate of candidates) {
    const candidateRows = (rows ?? []).filter((row) => row.gp_id === candidate.id && row.drivers)
    const observedLineup = new Map(
      candidateRows
        .filter((row) => row.observed_at !== null)
        .map((row) => [row.drivers!.code, row.team_name]),
    )
    const lineup = new Map<string, string>()
    for (const row of candidateRows) {
      if (row.observed_at === null && isSeatTaken(row.team_name, observedLineup)) continue
      lineup.set(row.drivers!.code, row.team_name)
    }
    if (lineup.size > 0) return lineup
  }
  return new Map()
}

/** Nom de famille par code pilote pour la saison — libellés du push line-up (pilotes remplacés, #255). */
export async function getDriverLastNames(
  season: number,
  driverCodes: string[],
): Promise<Map<string, string>> {
  if (driverCodes.length === 0) return new Map()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('drivers')
    .select('code, last_name')
    .eq('season', season)
    .in('code', driverCodes)

  if (error) throw error
  return new Map((data ?? []).map((driver) => [driver.code, driver.last_name]))
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
