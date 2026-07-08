import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { isCronAuthorized } from '@/lib/api/cron'
import { isPushConfigured, sendAnnouncement } from '@/lib/push/send'
import { toInternalPath } from '@/lib/push/internal-path'

// Bornes de contenu — cadre la « forme » recommandée dans la spec (titre court + une
// phrase) et évite de stocker/pousser un payload aberrant même muni du secret.
const MAX_TITLE_LENGTH = 80
const MAX_BODY_LENGTH  = 200

// Diffuse une ANNONCE PRODUIT (« Nouveautés ») à tous les abonnés ayant gardé l'opt-in
// `notif_announcements`. Déclenché MANUELLEMENT par l'équipe (pas de cron) : annonce d'une
// nouvelle feature, d'un correctif notable ou d'un message produit.
//
// Chaque envoi crée une ligne `announcements` (historique + source de /whats-new) puis
// diffuse le push. L'envoi est idempotent :
//   • claim atomique de `sent_at` → jamais deux pushs pour la même ligne
//   • `key` optionnelle → un retry avec la même clé retombe sur la même annonce (pas de doublon)
//
// Protégé par le même secret que les crons (CRON_SECRET) — aucune surface d'attaque nouvelle.
// Auth : header `x-cron-secret: <CRON_SECRET>` (ou `Authorization: Bearer <…>`).
//
// Paramètres (query OU corps JSON) :
//   title (requis) · body (requis) · url (interne, défaut /whats-new) · key (optionnelle, idempotence)
//
// Exemple :
//   curl -H "x-cron-secret: $CRON_SECRET" \
//     "https://<domaine>/api/admin/announce?title=🆕%20Avatars%20custom&body=Ajoute%20ta%20photo%20de%20profil%20!&url=/profile/edit-avatar"
async function handler(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sans clés VAPID, sendAnnouncement no-op silencieusement : on renvoie un 503 parlant
  // (et on ne crée aucune ligne `announcements`) pour un diagnostic clair.
  if (!isPushConfigured()) {
    return Response.json(
      {
        error: 'Push non configuré : clés VAPID absentes',
        missing: 'VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY',
      },
      { status: 503 },
    )
  }

  const { title: rawTitle, body: rawBody, url, key } = await readParams(request)
  const title = rawTitle?.trim()
  const body  = rawBody?.trim()
  if (!title || !body) {
    return Response.json({ error: 'Paramètres requis : title, body' }, { status: 400 })
  }
  if (title.length > MAX_TITLE_LENGTH || body.length > MAX_BODY_LENGTH) {
    return Response.json(
      { error: `Trop long : title ≤ ${MAX_TITLE_LENGTH}, body ≤ ${MAX_BODY_LENGTH} caractères` },
      { status: 400 },
    )
  }
  // url interne uniquement (le SW ouvre l'URL au clic) ; défaut = page Nouveautés.
  const target = toInternalPath(url, '/whats-new')

  const supabase = createServiceClient()

  try {
    // 1. Créer (ou retrouver) la ligne d'annonce.
    let announcementId: string
    let alreadySent = false

    if (key) {
      // Retry-idempotent : même `key` ⇒ même annonce. ignoreDuplicates renvoie [] si la
      // ligne existe déjà → on la relit pour connaître son état d'envoi.
      const { data: inserted, error: insertError } = await supabase
        .from('announcements')
        .upsert({ title, body, url: target, dedup_key: key }, { onConflict: 'dedup_key', ignoreDuplicates: true })
        .select('id')
      if (insertError) throw insertError

      if (inserted && inserted.length > 0) {
        announcementId = inserted[0].id
      } else {
        const { data: existing, error: selectError } = await supabase
          .from('announcements')
          .select('id, sent_at')
          .eq('dedup_key', key)
          .single()
        if (selectError || !existing) throw selectError ?? new Error('annonce introuvable')
        announcementId = existing.id
        alreadySent = existing.sent_at !== null
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('announcements')
        .insert({ title, body, url: target })
        .select('id')
        .single()
      if (insertError || !inserted) throw insertError ?? new Error('insertion échouée')
      announcementId = inserted.id
    }

    if (alreadySent) {
      return Response.json({ skipped: 'already_sent', announcementId })
    }

    // 2. Claim atomique de l'envoi : garantit qu'une même annonce n'est diffusée qu'une fois
    //    (même principe que les colonnes notified_* / claimSession*).
    const { data: claimed, error: claimError } = await supabase
      .from('announcements')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', announcementId)
      .is('sent_at', null)
      .select('id')
    if (claimError) throw claimError
    if (!claimed || claimed.length === 0) {
      return Response.json({ skipped: 'already_sent', announcementId })
    }

    // 3. Diffuser aux abonnés opt-in.
    await sendAnnouncement({ title, body, url: target })

    return Response.json({ sent: true, announcementId, payload: { title, body, url: target } })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    return Response.json({ error: 'Envoi de l’annonce échoué', detail }, { status: 500 })
  }
}

// Lit title/body/url/key depuis la query string ou un corps JSON (les deux acceptés).
async function readParams(
  request: Request,
): Promise<{ title: string | null; body: string | null; url: string | null; key: string | null }> {
  const url = new URL(request.url)
  const fromQuery = {
    title: url.searchParams.get('title'),
    body:  url.searchParams.get('body'),
    url:   url.searchParams.get('url'),
    key:   url.searchParams.get('key'),
  }
  if (request.method !== 'POST') return fromQuery

  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return fromQuery
    const json = (await request.json()) as Record<string, unknown>
    const pick = (v: unknown, fallback: string | null): string | null =>
      typeof v === 'string' ? v : fallback
    return {
      title: pick(json.title, fromQuery.title),
      body:  pick(json.body, fromQuery.body),
      url:   pick(json.url, fromQuery.url),
      key:   pick(json.key, fromQuery.key),
    }
  } catch {
    // Corps illisible : on retombe sur la query string.
    return fromQuery
  }
}

export const GET  = handler
export const POST = handler
