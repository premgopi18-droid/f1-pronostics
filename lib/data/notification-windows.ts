import type { DbSessionType, SessionType } from '@/lib/scoring/types'

// Logique PURE (sans I/O) de sélection des fenêtres de rappel push. Extraite des
// selectors Supabase de `f1-sync.ts` pour être testable : tri/regroupement par GP,
// « session suivante », bornes temporelles. Les fonctions reçoivent des rows déjà
// mappées + un `now` injecté (déterminisme des tests).

export const POST_SESSION_NUDGE_DELAY_MS = 2 * 60 * 60 * 1000 // 2h après le début de la session
export const QUAL_REMINDER_WINDOW_MS     = 24 * 60 * 60 * 1000 // rappel « pronos J-1 »
export const IMMINENCE_WINDOW_MS         = 10 * 60 * 1000       // 10 min avant le début
export const CATCH_UP_DEADLINE_WINDOW_MS = 2 * 60 * 60 * 1000   // rattrapage à l'activation des push (#115)

// ── Nudge « tu peux encore ajuster la session suivante » ──────────────────────

export interface NudgeSessionRow {
  id:          string
  type:        SessionType
  gpId:        string
  gpName:      string
  isCancelled: boolean
  startsAt:    Date
  notified:    boolean
}

export interface NudgeTarget {
  id:       string
  nextType: SessionType
  gpId:     string
  gpName:   string
}

// Pour chaque session non-finale d'un GP (toutes sauf la dernière par starts_at),
// renvoie une cible de nudge si : ≥ 2h depuis son début ET la session suivante n'a
// pas encore démarré (un prono se verrouille au début de sa session). Ignore les GP
// annulés et les sessions déjà nudgées.
export function selectSessionsToNudge(rows: NudgeSessionRow[], now: Date): NudgeTarget[] {
  const byGP = new Map<string, NudgeSessionRow[]>()
  for (const row of rows) {
    const list = byGP.get(row.gpId) ?? []
    list.push(row)
    byGP.set(row.gpId, list)
  }

  const result: NudgeTarget[] = []
  for (const sessions of byGP.values()) {
    sessions.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    for (let i = 0; i < sessions.length - 1; i++) {
      const current = sessions[i]
      const next    = sessions[i + 1]
      if (current.isCancelled || current.notified) continue
      const elapsed = now.getTime() - current.startsAt.getTime()
      if (elapsed >= POST_SESSION_NUDGE_DELAY_MS && now < next.startsAt) {
        result.push({ id: current.id, nextType: next.type, gpId: current.gpId, gpName: current.gpName })
      }
    }
  }
  return result
}

// ── Session imminente (10 min avant le début) ─────────────────────────────────

export interface ImminenceSessionRow {
  id:          string
  type:        DbSessionType
  gpId:        string
  gpName:      string
  isCancelled: boolean
  startsAt:    Date
  notified:    boolean
}

// Cible les sessions dont `startsAt` ∈ [now, now + 10min], non annulées,
// non déjà notifiées. La borne basse est inclusive (on ne manque pas le cron
// qui tourne exactement à T-10) ; la borne haute laisse une marge par rapport
// au cron suivant (toutes les 10 min).
export function selectSessionsStartingSoon(rows: ImminenceSessionRow[], now: Date): ImminenceSessionRow[] {
  const limit = new Date(now.getTime() + IMMINENCE_WINDOW_MS)
  return rows.filter(
    (row) => !row.isCancelled && !row.notified && row.startsAt >= now && row.startsAt <= limit,
  )
}

// ── Rattrapage à l'activation des push (#115) ─────────────────────────────────

export interface CatchUpDeadlineRow {
  gpId:     string
  gpName:   string
  type:     SessionType
  startsAt: Date
}

// Quand un utilisateur active les push en plein week-end, le cron de rappel
// (J-1, 1h avant) est déjà passé. À l'abonnement, on cherche la deadline scorable
// la plus proche dont `startsAt` tombe dans [now, now + CATCH_UP_DEADLINE_WINDOW_MS]
// pour le prévenir immédiatement. Une seule cible (la plus imminente) → un seul
// message. Les rows reçues sont déjà filtrées (scorables, non annulées) côté requête.
// Bornes inclusives : on ne veut pas rater une deadline pile à `now` ou à la limite.
export function selectClosestCatchUpDeadline(
  rows: CatchUpDeadlineRow[],
  now:  Date,
): CatchUpDeadlineRow | null {
  const limit = new Date(now.getTime() + CATCH_UP_DEADLINE_WINDOW_MS)
  const inWindow = rows.filter((row) => row.startsAt >= now && row.startsAt <= limit)
  if (inWindow.length === 0) return null
  return inWindow.reduce((closest, row) => (row.startsAt < closest.startsAt ? row : closest))
}

// ── Rappel « pronos J-1 » (au niveau GP) ──────────────────────────────────────

export interface QualReminderRow {
  gpId:        string
  gpName:      string
  isCancelled: boolean
  notified:    boolean
  startsAt:    Date // début d'UNE session du GP
}

// Renvoie les GP dont la PREMIÈRE session (min starts_at) tombe dans les prochaines
// 24h et qui n'ont pas encore reçu le rappel. Ignore les GP annulés / déjà notifiés.
export function selectGPsToRemind(rows: QualReminderRow[], now: Date): { id: string; name: string }[] {
  const limit = new Date(now.getTime() + QUAL_REMINDER_WINDOW_MS)

  // Première session (min starts_at) de chaque GP.
  const earliestByGP = new Map<string, QualReminderRow>()
  for (const row of rows) {
    const current = earliestByGP.get(row.gpId)
    if (!current || row.startsAt < current.startsAt) {
      earliestByGP.set(row.gpId, row)
    }
  }

  const result: { id: string; name: string }[] = []
  for (const row of earliestByGP.values()) {
    if (row.isCancelled || row.notified) continue
    if (row.startsAt >= now && row.startsAt <= limit) {
      result.push({ id: row.gpId, name: row.gpName })
    }
  }
  return result
}
