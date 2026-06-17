import { createServiceClient } from '@/lib/supabase'
import type { SessionType } from '@/lib/scoring/types'
import type { CalendarEntry, ConstructorEntry, DriverConstructorLink, DriverEntry } from '@/lib/f1/jolpica'

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
  sessions: { type: SessionType; startsAt: string }[],
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

// GPs dont le scoring est finalisé et la notification résultats pas encore envoyée
export async function getGPsNeedingScoreNotification(
  season: number,
): Promise<{ id: string; name: string }[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('grands_prix')
    .select('id, name')
    .eq('season', season)
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

// Toutes les sessions d'un GP avec leur statut de confirmation — 1 requête vs N getSessionId
export async function getSessionsForGP(
  gpId: string,
): Promise<{ id: string; type: SessionType; confirmedAt: string | null }[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('id, type, results_confirmed_at')
    .eq('gp_id', gpId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id:          row.id as string,
    type:        row.type as SessionType,
    confirmedAt: row.results_confirmed_at as string | null,
  }))
}
