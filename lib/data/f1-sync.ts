import { createServiceClient } from '@/lib/supabase'
import type { SessionType } from '@/lib/scoring/types'
import type { CalendarEntry, ConstructorEntry, DriverEntry } from '@/lib/f1/jolpica'

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
  const { error } = await supabase
    .from('drivers')
    .upsert(
      entries.map((d) => ({
        season:     d.season,
        code:       d.code,
        first_name: d.firstName,
        last_name:  d.lastName,
        number:     d.number,
      })),
      { onConflict: 'season,code' },
    )
  if (error) throw error
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
