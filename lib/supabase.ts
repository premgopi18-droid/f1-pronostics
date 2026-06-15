// Empêche tout import de ce module dans un bundle client (erreur de build) —
// le client service-role ci-dessous porte la clé secrète, jamais côté navigateur.
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie writes are no-op
          }
        },
      },
    }
  )
}

// Client service-role — BYPASS le RLS. Réservé au code serveur de confiance
// (cron / route handlers protégés par CRON_SECRET : scoring, sync F1). C'est le
// client utilisé par toute la couche `lib/data/`, qui lit/écrit en masse pour
// TOUS les joueurs sans `auth.uid()`. Ne JAMAIS l'exposer au navigateur, et ne
// JAMAIS l'utiliser pour une lecture déclenchée par une action utilisateur —
// celles-ci passent par `createClient()` (cookie/RLS) pour que les policies
// (deadline pronos, co-membre de ligue…) s'appliquent.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}
