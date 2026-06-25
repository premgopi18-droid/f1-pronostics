import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { isCronAuthorized } from '@/lib/api/cron'
import { isPushConfigured, sendPushToAll, sendPushToUser } from '@/lib/push/send'

// Endpoint de diagnostic : envoie une notification push de test À LA DEMANDE, sans
// dépendre des crons ni des conditions de dédup (flags notified_*). Sert à vérifier
// de bout en bout la livraison Web Push : clés VAPID + abonnements + service worker.
//
// IMPORTANT : contrairement aux autres routes /api/dev/*, celle-ci n'est PAS bloquée
// en production — son intérêt est justement de tester la livraison réelle là où VAPID
// et les abonnements existent (la prod). Elle reste protégée par le même secret que
// les crons (CRON_SECRET), donc aucune surface d'attaque nouvelle.
//
// Auth : header `x-cron-secret: <CRON_SECRET>` (ou `Authorization: Bearer <…>`).
//
// Paramètres (query, tous optionnels) :
//   userId        : n'envoyer qu'aux abonnements de cet utilisateur (sinon : à tous)
//   title / body / url : personnaliser le contenu du push
//
// Exemples :
//   curl -H "x-cron-secret: $CRON_SECRET" https://<domaine>/api/dev/test-push
//   curl -H "x-cron-secret: $CRON_SECRET" "https://<domaine>/api/dev/test-push?userId=<uuid>"
async function handler(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Guard explicite : sans clés VAPID, sendPush* no-op silencieusement. On renvoie
  // plutôt un 503 parlant pour que le diagnostic soit clair (ex. appel en local).
  if (!isPushConfigured()) {
    return Response.json(
      {
        error: 'Push non configuré : clés VAPID absentes',
        missing: 'VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY',
      },
      { status: 503 },
    )
  }

  const url    = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const title  = url.searchParams.get('title') ?? '🔔 Test BoxBox'
  const body   = url.searchParams.get('body')
    ?? 'Notification de test — si tu la vois, le push fonctionne !'

  // Le SW fait `clients.openWindow(data.url)` au clic : on n'accepte qu'un chemin
  // interne pour qu'un appelant (même muni du secret) ne puisse pas ouvrir un
  // domaine externe (phishing). On refuse l'absolu et le protocol-relative (`//`).
  const rawUrl = url.searchParams.get('url') ?? '/'
  const target = rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/'

  try {
    // Compte les abonnements ciblés (diagnostic : 0 ⇒ personne d'abonné côté base).
    const supabase = createServiceClient()
    let countQuery = supabase
      .from('push_subscriptions')
      .select('endpoint', { count: 'exact', head: true })
    if (userId) countQuery = countQuery.eq('user_id', userId)
    const { count, error } = await countQuery
    if (error) {
      return Response.json(
        { error: 'Comptage des abonnements échoué', detail: error.message },
        { status: 500 },
      )
    }

    const payload = { title, body, url: target }
    if (userId) {
      await sendPushToUser(userId, payload)
    } else {
      await sendPushToAll(payload)
    }

    return Response.json({
      sent: userId ? `user:${userId}` : 'all',
      subscriptionsTargeted: count ?? 0,
      payload,
    })
  } catch (err: unknown) {
    // Filet : sendPush* avalent déjà leurs erreurs (allSettled), mais un throw
    // inattendu (ex. createServiceClient) doit rester un 500 lisible.
    const detail = err instanceof Error ? err.message : String(err)
    return Response.json({ error: 'Envoi du push de test échoué', detail }, { status: 500 })
  }
}

export const GET  = handler
export const POST = handler
