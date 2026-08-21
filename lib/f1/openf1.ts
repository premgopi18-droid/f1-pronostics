import type { DriverResult } from '@/lib/scoring/types'

const BASE_URL = 'https://api.openf1.org/v1'

// ============================================================
// Types internes — structure de réponse OpenF1 (subset utile)
// ============================================================

interface OpenF1Session {
  session_key:  number
  session_name: string   // "Sprint Qualifying", "Race", etc.
  year:         number
  circuit_short_name: string
  date_start:   string   // ISO — début officiel de la session (UTC)
  date_end:     string   // ISO — fin officielle de la session
}

interface OpenF1Lap {
  driver_number: number
  lap_duration:  number | null  // secondes ; null sur les tours in/out
  date_start:    string | null  // ISO — début du tour ; départage les ex aequo
}

interface OpenF1Driver {
  driver_number: number
  name_acronym:  string         // "VER", "NOR" — équivalent du code Jolpica
  session_key:   number
  team_name:     string | null  // libellé humain ("Red Bull Racing") — PAS un code interne
}

interface OpenF1Position {
  driver_number: number
  position:      number
  date:          string  // ISO — entrée la plus récente = position finale
}

// ============================================================
// Types publics — essais libres
// ============================================================

export type PracticeSessionName = 'Practice 1' | 'Practice 2' | 'Practice 3'

export type PracticeDriverResult = {
  position:    number
  driverCode:  string
  bestLapTime: string | null
}

function formatLapTime(durationSeconds: number): string {
  const totalMs = Math.round(durationSeconds * 1000)
  const mins = Math.floor(totalMs / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

// ============================================================
// Helper HTTP
// ============================================================

async function openf1Get<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: 30 },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`OpenF1 ${path} → HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

// OpenF1 publie les positions/tours EN DIRECT pendant la session : on n'exploite
// le classement qu'une fois la session terminée, sinon on figerait un ordre
// intermédiaire (le cron confirme dès qu'il obtient un résultat non vide).
function isSessionFinished(session: OpenF1Session): boolean {
  return new Date(session.date_end).getTime() <= Date.now()
}

// Tolérance de rapprochement entre la date Jolpica (planning du week-end) et la
// date OpenF1 (début réel de la session). Les GP sont espacés d'au moins ~6
// jours : une fenêtre de 2 jours identifie le bon week-end sans risque de capter
// un AUTRE GP, tout en absorbant un éventuel décalage de planning ou de fuseau.
const SESSION_MATCH_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

// Sélectionne la session OpenF1 d'un GP donné SANS dépendre du nom de circuit :
// le `circuit_short_name` OpenF1 (« Catalunya », « Interlagos »…) ne matche pas
// toujours la locality Jolpica (« Montmeló », « São Paulo »…), ce qui renvoyait
// des résultats vides. On récupère donc toutes les sessions de l'année pour ce
// nom, puis on retient la plus proche en date de la session attendue côté
// Jolpica — et seulement si elle tombe dans la fenêtre (sinon : pas encore
// publiée → null, le cron retentera).
async function findSessionByDate(
  year: number,
  sessionName: string,
  expectedStartsAt: string,
): Promise<OpenF1Session | null> {
  const sessions = await openf1Get<OpenF1Session[]>(
    `/sessions?year=${year}&session_name=${encodeURIComponent(sessionName)}`,
  )
  if (!sessions?.length) return null

  const expected = new Date(expectedStartsAt).getTime()
  let best: OpenF1Session | null = null
  let bestDelta = Infinity
  for (const session of sessions) {
    const delta = Math.abs(new Date(session.date_start).getTime() - expected)
    if (delta < bestDelta) {
      bestDelta = delta
      best = session
    }
  }
  return best && bestDelta <= SESSION_MATCH_WINDOW_MS ? best : null
}

// ============================================================
// Sprint Qualifying (Shootout) — non disponible dans Jolpica
// Retourne la classification finale : code → position
// ============================================================

export async function fetchSprintQualifyingResults(
  year: number,
  expectedStartsAt: string,
): Promise<Map<string, DriverResult>> {
  // 1. Trouver la session_key du Sprint Qualifying (rapproché par date)
  const session = await findSessionByDate(year, 'Sprint Qualifying', expectedStartsAt)
  if (!session) return new Map()
  if (!isSessionFinished(session)) return new Map()

  // 2. Pilotes de la session → code acronyme
  const [drivers, positions] = await Promise.all([
    openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`),
    openf1Get<OpenF1Position[]>(`/position?session_key=${session.session_key}`),
  ])

  const numberToCode = new Map((drivers ?? []).map((d) => [d.driver_number, d.name_acronym]))

  // 3. Garder la dernière position connue par pilote (= classement final)
  const finalPositions = new Map<number, number>()
  for (const entry of positions ?? []) {
    finalPositions.set(entry.driver_number, entry.position)
  }

  const result = new Map<string, DriverResult>()
  for (const [number, position] of finalPositions) {
    const code = numberToCode.get(number)
    // Position inattribuable (numéro absent du /drivers de la session) = le
    // /drivers est encore le pré-seed périmé d'OpenF1 (mis à jour ~1 h après la
    // séance — #215). Un classement partiel serait structurellement faux — et
    // ici SCORÉ : on renvoie « pas encore dispo », le cron retentera.
    if (!code) {
      console.warn(
        `fetchSprintQualifyingResults : numéro ${number} absent du /drivers de la session ${session.session_key} — classement différé`,
      )
      return new Map()
    }
    result.set(code, { position, fastestLap: false })
  }
  return result
}

// ============================================================
// Grille de départ (course / sprint) — non disponible dans Jolpica
// OpenF1 publie /starting_grid AVANT le départ, pénalités et départs pit lane
// inclus — contrairement aux classements, on ne gate donc PAS sur
// isSessionFinished : c'est précisément la fenêtre pré-course qui nous
// intéresse. Retourne code pilote → position de grille ; Map vide tant que la
// grille n'est pas publiée (le cron retentera).
//
// ⚠️ L'endpoint est indexé par le session_key de la session QUALIFICATIVE qui
// produit la grille (Qualifying → course, Sprint Qualifying → sprint), PAS par
// la session course — vérifié empiriquement (review PR #202) : le session_key
// d'une course renvoie 404, celui de sa qualif renvoie la grille complète.
// ============================================================

export type GridSessionName = 'Qualifying' | 'Sprint Qualifying'

interface OpenF1GridEntry {
  driver_number: number
  position:      number | null  // null/0 : pas de position de grille (pit lane)
}

export function mapStartingGrid(
  entries: OpenF1GridEntry[],
  drivers: OpenF1Driver[],
): Map<string, number> {
  const numberToCode = new Map(drivers.map((d) => [d.driver_number, d.name_acronym]))
  const grid = new Map<string, number>()
  for (const entry of entries) {
    if (entry.position == null || entry.position <= 0) continue
    const code = numberToCode.get(entry.driver_number)
    if (code) grid.set(code, entry.position)
  }
  return grid
}

export async function fetchStartingGrid(
  year: number,
  sessionName: GridSessionName,
  expectedStartsAt: string,
): Promise<Map<string, number>> {
  const session = await findSessionByDate(year, sessionName, expectedStartsAt)
  if (!session) return new Map()

  const [entries, drivers] = await Promise.all([
    openf1Get<OpenF1GridEntry[]>(`/starting_grid?session_key=${session.session_key}`),
    openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`),
  ])
  if (!entries?.length || !drivers?.length) return new Map()

  return mapStartingGrid(entries, drivers)
}

// ============================================================
// Line-up d'une session — code pilote → nom d'écurie OpenF1 brut
// Disponible dès que la session existe côté OpenF1 (EL1 du vendredi) : pas de
// gate isSessionFinished, c'est la fenêtre AVANT la course qui nous intéresse
// (détection des changements de baquet, #205). ⚠️ team_name est un libellé
// humain (« Red Bull Racing ») qui ne matche ni les codes internes ni les noms
// Jolpica — ne comparer que du OpenF1 avec du OpenF1.
// ============================================================

export async function fetchSessionLineup(
  year: number,
  sessionName: string,
  expectedStartsAt: string,
): Promise<Map<string, string>> {
  const session = await findSessionByDate(year, sessionName, expectedStartsAt)
  if (!session) return new Map()

  const drivers = await openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`)

  const lineup = new Map<string, string>()
  for (const driver of drivers ?? []) {
    if (driver.name_acronym && driver.team_name) {
      lineup.set(driver.name_acronym, driver.team_name)
    }
  }
  return lineup
}

// ============================================================
// Essais libres (EL1/EL2/EL3) — non disponible dans Jolpica
// Le classement d'une séance d'essais est trié par MEILLEUR TOUR (feuille de
// temps), pas par position sur la piste — on dérive donc le classement depuis
// /laps (min lap_duration par pilote), et non depuis /position.
// ============================================================

export async function fetchPracticeResults(
  year: number,
  sessionName: PracticeSessionName,
  expectedStartsAt: string,
): Promise<PracticeDriverResult[]> {
  const session = await findSessionByDate(year, sessionName, expectedStartsAt)
  if (!session) return []
  if (!isSessionFinished(session)) return []

  const [drivers, laps] = await Promise.all([
    openf1Get<OpenF1Driver[]>(`/drivers?session_key=${session.session_key}`),
    openf1Get<OpenF1Lap[]>(`/laps?session_key=${session.session_key}`),
  ])

  const numberToCode = new Map((drivers ?? []).map((d) => [d.driver_number, d.name_acronym]))

  // Meilleur tour par pilote (les tours in/out ont lap_duration null → ignorés).
  const bestLapByDriver = new Map<number, { duration: number; setAt: string }>()
  for (const lap of laps ?? []) {
    if (lap.lap_duration == null) continue
    const current = bestLapByDriver.get(lap.driver_number)
    if (current === undefined || lap.lap_duration < current.duration) {
      bestLapByDriver.set(lap.driver_number, { duration: lap.lap_duration, setAt: lap.date_start ?? '' })
    }
  }

  // Classement par meilleur tour croissant ; ex aequo départagés par le 1er à
  // avoir signé le temps (règle F1). Positions denses 1..N.
  // NB : une séance terminée a toujours des tours chronométrés — une liste vide
  // ici signifie donc « données OpenF1 pas encore dispo », et le cron retentera.
  const ranked = [...bestLapByDriver.entries()].sort((a, b) =>
    a[1].duration !== b[1].duration ? a[1].duration - b[1].duration : a[1].setAt.localeCompare(b[1].setAt),
  )
  const results: PracticeDriverResult[] = []
  let position = 1
  for (const [number, lap] of ranked) {
    const code = numberToCode.get(number)
    // Tour chronométré inattribuable (numéro absent du /drivers de la session) =
    // le /drivers est encore le pré-seed périmé d'OpenF1 (mis à jour ~1 h après
    // la séance — #215, EL1 Zandvoort 2026 : les 34 tours de Tsunoda écartés en
    // silence, classement confirmé faux). Les positions d'un classement partiel
    // sont structurellement fausses : « pas encore dispo », le cron retentera.
    if (!code) {
      console.warn(
        `fetchPracticeResults : numéro ${number} absent du /drivers de la session ${session.session_key} — classement différé`,
      )
      return []
    }
    results.push({ position: position++, driverCode: code, bestLapTime: formatLapTime(lap.duration) })
  }

  return results
}
