import 'server-only'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase'

interface PushPayload {
  title: string
  body:  string
  url:   string
}

// Init paresseuse des clés VAPID : `setVapidDetails` lève si une clé manque, donc
// on ne l'appelle jamais à l'import (sinon les route handlers qui importent ce
// module crashent quand VAPID n'est pas configuré). Renvoie false si non configuré.
let vapidConfigured = false

function configureVapid(): boolean {
  if (vapidConfigured) return true
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
  return true
}

// True si les clés VAPID sont présentes (configure web-push au passage si besoin).
// À tester avant de "claim"/marquer une notification : évite de brûler le flag de
// dédup quand aucun push ne pourra partir (VAPID absent ou en panne).
export function isPushConfigured(): boolean {
  return configureVapid()
}

async function deliverToSubs(
  subs: { endpoint: string; p256dh: string; auth_key: string }[],
  payload: PushPayload,
): Promise<void> {
  if (subs.length === 0) return
  const supabase = createServiceClient()
  const body = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          body,
        )
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }),
  )
}

// PostgREST plafonne le nombre de lignes renvoyées par requête (souvent 1000). Pour les
// envois de masse (broadcast, imminence, annonces), on lit donc les lignes par pages
// successives jusqu'à épuisement — sinon les abonnés au-delà du plafond seraient
// SILENCIEUSEMENT ignorés (aucune erreur, juste un envoi tronqué).
const PAGE_SIZE = 1000

// Taille de lot du filtre `.in('user_id', …)` : borne la longueur de l'URL PostgREST
// quand la liste d'utilisateurs opt-in devient grande (nécessaire dès qu'on pagine
// les profils au-delà d'une page).
const USER_ID_BATCH_SIZE = 300

// Lit TOUTES les lignes d'une requête paginable, page par page. `page` doit reconstruire
// la requête à chaque appel (filtres inclus) et y appliquer `.range(from, to)`.
async function fetchAllPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

type RawRow = Record<string, unknown>

function toSubscriptionRows(rows: RawRow[]): { endpoint: string; p256dh: string; auth_key: string }[] {
  return rows.map((s) => ({
    endpoint: s.endpoint as string,
    p256dh:   s.p256dh   as string,
    auth_key: s.auth_key as string,
  }))
}

// Récupère tous les abonnements d'un ensemble d'utilisateurs, par lots (`.in`) et par
// pages, pour ne rien tronquer même à grande échelle.
async function fetchSubscriptionsForUsers(userIds: string[]) {
  if (userIds.length === 0) return []
  const supabase = createServiceClient()
  const rows: RawRow[] = []
  for (let i = 0; i < userIds.length; i += USER_ID_BATCH_SIZE) {
    const batch = userIds.slice(i, i + USER_ID_BATCH_SIZE)
    const batchRows = await fetchAllPaged<RawRow>((from, to) =>
      supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key')
        .in('user_id', batch)
        .range(from, to),
    )
    rows.push(...batchRows)
  }
  return toSubscriptionRows(rows)
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!configureVapid()) return
  const supabase = createServiceClient()
  const subs = await fetchAllPaged<RawRow>((from, to) =>
    supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key').range(from, to),
  )
  await deliverToSubs(toSubscriptionRows(subs), payload)
}

// Envoie la notif "session imminente" aux utilisateurs dont la préférence
// `notif_imminence_scope` couvre le type de session :
//   isStakesSession = true  → 'all' + 'stakes-only'
//   isStakesSession = false → 'all' uniquement (sessions EL)
export async function sendImminencePush(payload: PushPayload, isStakesSession: boolean): Promise<void> {
  if (!configureVapid()) return
  const supabase = createServiceClient()

  const scopes = isStakesSession ? ['all', 'stakes-only'] : ['all']

  const profiles = await fetchAllPaged<RawRow>((from, to) =>
    supabase.from('profiles').select('id').in('notif_imminence_scope', scopes).range(from, to),
  )
  const userIds = profiles.map((p) => p.id as string)

  await deliverToSubs(await fetchSubscriptionsForUsers(userIds), payload)
}

// Envoie à UN abonnement précis (clés déjà en main, sans relire la base). Utile
// quand on cible l'appareil qui vient de s'abonner plutôt que tous ceux du user
// (évite de re-notifier un appareil déjà prévenu — cf. notif de rattrapage #115).
export async function sendPushToSubscription(
  sub:     { endpoint: string; p256dh: string; auth_key: string },
  payload: PushPayload,
): Promise<void> {
  if (!configureVapid()) return
  await deliverToSubs([sub], payload)
}

// Diffuse une ANNONCE PRODUIT (« Nouveautés ») aux utilisateurs ayant gardé l'opt-in
// `notif_announcements` (défaut true). Broadcast éditorial déclenché manuellement par
// l'équipe (endpoint admin), jamais par un cron. Même patron que `sendImminencePush` :
// on filtre d'abord les profils sur la préférence, puis on récupère leurs abonnements.
export async function sendAnnouncement(payload: PushPayload): Promise<void> {
  if (!configureVapid()) return
  const supabase = createServiceClient()

  const profiles = await fetchAllPaged<RawRow>((from, to) =>
    supabase.from('profiles').select('id').eq('notif_announcements', true).range(from, to),
  )
  const userIds = profiles.map((p) => p.id as string)

  await deliverToSubs(await fetchSubscriptionsForUsers(userIds), payload)
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configureVapid()) return
  await deliverToSubs(await fetchSubscriptionsForUsers([userId]), payload)
}
