import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { isCronAuthorized } from '@/lib/api/cron'
import type { Json } from '@/lib/database.types'

// Synchronise les tracés de circuits depuis bacinger/f1-circuits vers `circuit_tracks`.
// POST uniquement (pas de cron Vercel — appel manuel au déploiement / si un tracé change).
// Protégé par `CRON_SECRET` via `isCronAuthorized`.

const BACINGER_GEOJSON_URL =
  'https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson'

interface BacingerFeature {
  properties: { id: string; Name: string }
  geometry: { type: string; coordinates: [number, number][] }
}

export async function POST(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(BACINGER_GEOJSON_URL, { cache: 'no-store' })
    if (!response.ok) {
      console.error('[api/admin/sync-circuits] fetch bacinger', response.status)
      return Response.json({ error: 'Source unavailable' }, { status: 502 })
    }

    const collection = (await response.json()) as { features?: BacingerFeature[] }
    const features = collection.features ?? []

    // La feature complète (geometry + properties) est stockée telle quelle : le composant
    // y lit les coordonnées ET la longueur du circuit (properties.length).
    const rows = features
      .filter((feature) => feature.properties?.id && feature.properties?.Name)
      .map((feature) => ({
        id: feature.properties.id,
        circuit_name: feature.properties.Name,
        // Frontière JSONB : BacingerFeature est sérialisable mais sans index
        // signature — cast assumé vers Json (colonne `geojson`).
        geojson: feature as unknown as Json,
        updated_at: new Date().toISOString(),
      }))

    const supabase = createServiceClient()
    const { error } = await supabase.from('circuit_tracks').upsert(rows, { onConflict: 'id' })
    if (error) throw error

    return Response.json({ synced: rows.length })
  } catch (error) {
    console.error('[api/admin/sync-circuits]', error)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
