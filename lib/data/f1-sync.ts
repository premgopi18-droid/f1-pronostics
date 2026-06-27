import { createServiceClient } from '@/lib/supabase'
import { SCOREABLE_SESSION_TYPES } from '@/lib/scoring/types'
import type { DbSessionType, SessionType } from '@/lib/scoring/types'
import type { CalendarEntry, ConstructorEntry, DriverConstructorLink, DriverEntry } from '@/lib/f1/jolpica'
import {
  selectGPsToRemind,
  selectSessionsToNudge,
  type NudgeSessionRow,
  type NudgeTarget,
  type QualReminderRow,
} from '@/lib/data/notification-windows'

// Appelé depuis /api/f1/sync — synchronise calendrier + pilotes + écuries depuis Jolpica

export async function upsertConstructors(entries: ConstructorEntry[]): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('constructors')
    .upsert(
      entries.map((c) => ({
        season:  c.season,
        code:    c.code,
        name:    c.name,
      })),
      { onConflict: 'season,code' },
    )
  if (error) throw error
}

export async function upsertDrivers(entries: DriverEntry[]): Promise<void> {
  if (entries.length === 0) return
  const supabase = createServiceClient()

  // Note : entries n'ont pas de constructorCode — le mapping écurie→pilote est fait
  // séparément par upsertDriverConstructorLinks() avec les standings Jolpica. Les
  // drivers sont donc upsertés ici sans constructor_id.
  // Jolpica renvoie parfois code=undefined pour les réservistes sans trigramme officiel
  const valid = entries.filter((d) => d.code)
  if (valid.length === 0) return

  const { error } = await supabase
    .from('drivers')
    .upsert(
      valid.map((d) => ({
        season:     d.season,
        code:       d.code,
        first_name: d.firstName,
        last_name:  d.lastName,
        number:     Number.isNaN(d.number) ? null : d.number,
      })),
      { onConflict: 'season,code' },
    )
  if (error) throw error
}

// Lie chaque pilote à son écurie pour la saison — appelé après upsertConstructors + upsertDrivers
export async function upsertDriverConstructorLinks(
  season: number,
  links:  DriverConstructorLink[],
): Promise<void> {
  if (links.length === 0) return
  const supabase = createServiceClient()

  // Résolution code écurie → UUID pour cette saison
  const constructorCodes = [...new Set(links.map((l) => l.constructorCode))]
  const { data: constructors, error: constructorsError } = await supabase
    .from('constructors')
    .select('id, code')
    .eq('season', season)
    .in('code', constructorCodes)
  if (constructorsError) throw constructorsError

  const codeToId = new Map((constructors ?? []).map((c) => [c.code as string, c.id as string]))

  // Signale les codes écurie introuvables dans `constructors` (sync incomplet ou
  // décalage de code) — sinon le pilote garde constructor_id null sans trace.
  const missingCodes = constructorCodes.filter((code) => !codeToId.has(code))
  if (missingCodes.length > 0) {
    console.warn(
      `upsertDriverConstructorLinks : écuries introuvables pour la saison ${season} — ${missingCodes.join(', ')}`,
    )
  }

  await Promise.all(
    links
      .filter((l) => codeToId.has(l.constructorCode))
      .map(async (l) => {
        const { error } = await supabase
          .from('drivers')
          .update({ constructor_id: codeToId.get(l.constructorCode)! })
          .eq('season', season)
          .eq('code', l.driverCode)
        if (error) throw error
      }),
  )
}

export async function upsertGrandsPrix(
  entries: CalendarEntry[],
): Promise<Map<number, string>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grands_prix')
    .upsert(
      entries.map((gp) => ({
        season:              gp.season,
        round:               gp.round,
        name:                gp.name,
        circuit:             gp.circuit,
        country:             gp.country,
        is_sprint_weekend:   gp.isSprintWeekend,
        weekend_starts_at:   gp.weekendStartsAt,
      })),
      { onConflict: 'season,round' },
    )
    .select('id, round')

  if (error) throw error
  return new Map((data ?? []).map((row) => [row.round as number, row.id as string]))
}

export async function upsertSessions(
  gpId:     string,
  season:   number,
  sessions: { type: DbSessionType; startsAt: string }[],
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('sessions')
    .upsert(
      sessions.map((s) => ({
        gp_id:      gpId,
        season,
        type:       s.type,
        starts_at:  s.startsAt,
      })),
      { onConflict: 'gp_id,type' },
    )
  if (error) throw error
}

// Appelé une fois les résultats officiels Jolpica stockés — déclenche le scoring
export async function confirmSessionResults(sessionId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('sessions')
    .update({ results_confirmed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function getSessionId(
  gpId: string,
  type: SessionType,
): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('gp_id', gpId)
    .eq('type', type)
    .single()

  if (error) return null
  return data?.id ?? null
}

// GPs dont le week-end commence dans les prochaines 48 h et pas encore notifiés
export async function getGPsNeedingOpenNotification(
  season: number,
): Promise<{ id: string; name: string }[]> {
  const supabase = createServiceClient()
  const now   = new Date()
  const limit = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name')
    .eq('season', season)
    .eq('is_cancelled', false)
    .is('notified_open_at', null)
    .gte('weekend_starts_at', now.toISOString())
    .lte('weekend_starts_at', limit.toISOString())

  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }))
}

export async function markGPNotifiedOpen(gpId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('grands_prix')
    .update({ notified_open_at: new Date().toISOString() })
    .eq('id', gpId)
  if (error) throw error
}

// GPs dont la PREMIÈRE session (= celle qui verrouille pronos + items : Sprint
// Qualifying en week-end sprint, Qualifications sinon) commence dans les
// prochaines 24h et qui n'ont pas encore reçu le rappel "pronos J-1".
// L'ancre = la session scorée la plus tôt du GP. On filtre sur
// SCOREABLE_SESSION_TYPES : la table `sessions` contient aussi les essais libres
// (informatifs), qui commencent avant la qualif — sans ce filtre, min(starts_at)
// tomberait sur l'EL1 au lieu de la vraie session-deadline.
export async function getGPsNeedingQualReminder(
  season: number,
): Promise<{ id: string; name: string }[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('sessions')
    .select('starts_at, gp_id, grands_prix!gp_id(id, name, is_cancelled, notified_reminder_24h_at)')
    .eq('season', season)
    .in('type', SCOREABLE_SESSION_TYPES)

  if (error) throw error

  type GPMeta = {
    id: string
    name: string
    is_cancelled: boolean
    notified_reminder_24h_at: string | null
  }

  const rows: QualReminderRow[] = []
  for (const raw of data ?? []) {
    const gp = raw.grands_prix as unknown as GPMeta | null
    if (!gp) continue
    rows.push({
      gpId:        gp.id,
      gpName:      gp.name,
      isCancelled: gp.is_cancelled,
      notified:    gp.notified_reminder_24h_at != null,
      startsAt:    new Date(raw.starts_at as string),
    })
  }

  return selectGPsToRemind(rows, new Date())
}

export async function markGPNotifiedQualReminder(gpId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('grands_prix')
    .update({ notified_reminder_24h_at: new Date().toISOString() })
    .eq('id', gpId)
  if (error) throw error
}

// GPs dont le scoring est finalisé et la notification résultats pas encore envoyée
export async function getGPsNeedingScoreNotification(
  season: number,
): Promise<{ id: string; name: string }[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name')
    .eq('season', season)
    .eq('is_cancelled', false)
    .not('scoring_finalized_at', 'is', null)
    .is('notified_scores_at', null)

  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }))
}

export async function markGPNotifiedScores(gpId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('grands_prix')
    .update({ notified_scores_at: new Date().toISOString() })
    .eq('id', gpId)
  if (error) throw error
}

// Sessions dont la deadline arrive dans la prochaine heure et pas encore notifiées
export async function getSessionsNeedingDeadlineNotification(
  season: number,
): Promise<{ id: string; type: SessionType; gpId: string; gpName: string }[]> {
  const supabase = createServiceClient()
  const now   = new Date()
  const limit = new Date(now.getTime() + 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('sessions')
    .select('id, type, gp_id, grands_prix!gp_id(name, is_cancelled)')
    .eq('season', season)
    .in('type', SCOREABLE_SESSION_TYPES)
    .is('notified_deadline_at', null)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', limit.toISOString())

  if (error) throw error
  type GPMeta = { name: string; is_cancelled: boolean }
  return (data ?? [])
    .filter((row) => !(row.grands_prix as unknown as GPMeta).is_cancelled)
    .map((row) => ({
      id:     row.id as string,
      type:   row.type as SessionType,
      gpId:   row.gp_id as string,
      gpName: (row.grands_prix as unknown as GPMeta).name,
    }))
}

// Revendique l'envoi de la notif "deadline" pour cette session : pose
// notified_deadline_at seulement si encore null (UPDATE conditionnel atomique).
// Renvoie true si CET appel a revendiqué l'envoi → dédup inter-run garantie,
// même si plusieurs crons se chevauchent. Marquer avant d'envoyer évite tout
// re-push de masse si l'envoi échoue ensuite (au pire un rare faux-négatif).
export async function claimSessionDeadlineNotification(sessionId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .update({ notified_deadline_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('notified_deadline_at', null)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

// Idem pour la notif "scores provisoires" — voir claimSessionDeadlineNotification.
export async function claimSessionProvisionalNotification(sessionId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .update({ notified_provisional_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('notified_provisional_at', null)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

// Sessions non-finales dont le nudge « tu peux encore ajuster la session suivante »
// est dû (ex. après la qualif → ajuster la course). La sélection (regroupement,
// fenêtre 2h, session suivante pas encore démarrée) vit dans `notification-windows`
// (pur, testé) ; ici on ne fait que charger + mapper les rows.
export async function getSessionsNeedingPostNudge(
  season: number,
): Promise<NudgeTarget[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('sessions')
    .select('id, type, gp_id, starts_at, notified_post_session_at, grands_prix!gp_id(name, is_cancelled)')
    .eq('season', season)
    .in('type', SCOREABLE_SESSION_TYPES)

  if (error) throw error

  type GPMeta = { name: string; is_cancelled: boolean }
  const rows: NudgeSessionRow[] = []
  for (const raw of data ?? []) {
    const gp = raw.grands_prix as unknown as GPMeta | null
    if (!gp) continue
    rows.push({
      id:          raw.id as string,
      type:        raw.type as SessionType,
      gpId:        raw.gp_id as string,
      gpName:      gp.name,
      isCancelled: gp.is_cancelled,
      startsAt:    new Date(raw.starts_at as string),
      notified:    raw.notified_post_session_at != null,
    })
  }

  return selectSessionsToNudge(rows, new Date())
}

// Claim atomique du nudge post-session — voir claimSessionDeadlineNotification.
export async function claimSessionPostNudge(sessionId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .update({ notified_post_session_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('notified_post_session_at', null)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

// Toutes les sessions d'un GP avec leur statut de confirmation — 1 requête vs N getSessionId
export async function getSessionsForGP(
  gpId: string,
): Promise<{ id: string; type: DbSessionType; confirmedAt: string | null }[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('id, type, results_confirmed_at')
    .eq('gp_id', gpId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id:          row.id as string,
    type:        row.type as DbSessionType,
    confirmedAt: row.results_confirmed_at as string | null,
  }))
}
