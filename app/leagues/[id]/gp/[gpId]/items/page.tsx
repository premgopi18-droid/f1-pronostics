import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase'
import { getCurrentSeason } from '@/lib/api/cron'
import { formatParis } from '@/lib/dates'
import { getCachedDrivers, getCachedConstructors } from '@/lib/f1/cached'
import { getUserGPItems, getPlayedGPItemForUser } from '@/lib/data/items'
import { getCurrentGp } from '@/lib/data/current-gp'
import { allItemLabels, ITEM_LOCK_PHASE } from '@/lib/items/catalog'
import {
  gpPlayability,
  itemAvailability,
  type ItemAvailability,
  type SessionTiming,
} from '@/lib/items/availability'
import { SCOREABLE_SESSION_TYPES, type SessionType } from '@/lib/scoring/types'
import { PlayItemForm } from './play-item-form'

// Libellés centralisés (i18n approche A) — source unique lib/items/catalog.ts.
const ITEM_LABELS = allItemLabels()

export default async function ItemsPage({
  params,
}: {
  params: Promise<{ id: string; gpId: string }>
}) {
  const { id: leagueId, gpId } = await params
  const supabase = await createClient()
  const season   = getCurrentSeason()
  const userId   = (await headers()).get('x-user-id')!

  // Toutes les requêtes en parallèle — y compris les items (userId dispo via header)
  // et drivers/constructors servis depuis le cache (0 RTT après le premier chargement)
  const [
    { data: gp },
    { data: sessions },
    { data: league },
    { data: members },
    driversRaw,
    constructorsRaw,
    userItems,
    playedItem,
    currentGp,
  ] = await Promise.all([
    supabase
      .from('grands_prix')
      .select('id, name, country, round, season, is_cancelled, is_sprint_weekend')
      .eq('id', gpId)
      .single(),
    supabase
      .from('sessions')
      .select('id, type, starts_at')
      .eq('gp_id', gpId)
      // Essais libres exclus : les paliers items portent sur les sessions scorées (cf. §211).
      .in('type', SCOREABLE_SESSION_TYPES)
      .order('starts_at', { ascending: true }),
    supabase
      .from('leagues')
      .select('id, name')
      .eq('id', leagueId)
      .single(),
    supabase
      .from('league_members')
      .select('user_id, profiles!user_id(pseudo)')
      .eq('league_id', leagueId)
      .eq('season', season),
    getCachedDrivers(season),
    getCachedConstructors(season),
    getUserGPItems(userId, leagueId, season),
    getPlayedGPItemForUser(userId, gpId, leagueId),
    getCurrentGp(season),
  ])

  if (!gp || !league) notFound()
  if (gp.season !== season || gp.is_cancelled) notFound()

  const nowMs = new Date().getTime()

  // Sessions scorées (type + horaire) — base des paliers et du gating par session.
  const scoredSessions: SessionTiming[] = (sessions ?? []).map((s) => ({
    type:     s.type as SessionType,
    startsAt: s.starts_at,
  }))

  // Jouabilité du GP : seul le GP courant est ouvert ; futurs verrouillés, passés fermés.
  const playability = gpPlayability(gp.round, currentGp?.round ?? null)

  // Sessions encore ciblables (pas démarrées) — le form les recroise avec ALLOWED_SESSIONS.
  const futureSessionTypes = scoredSessions
    .filter((s) => new Date(s.startsAt).getTime() > nowMs)
    .map((s) => s.type)

  // Disponibilité par item (grisage + motif). Calcul en mémoire — aucune requête par item.
  const availability: Record<string, ItemAvailability> = Object.fromEntries(
    (userItems ?? []).map((item) => [
      item.itemType,
      itemAvailability({
        phase:                ITEM_LOCK_PHASE[item.itemType] ?? 'pre_race',
        sessions:             scoredSessions,
        nowMs,
        hasPlayedThisWeekend: Boolean(playedItem),
        usesRemaining:        item.usesRemaining,
      }),
    ]),
  )

  // Deux deadlines de palier affichées (product-specs §3.5).
  const preQualifyingDeadline = scoredSessions[0] ? new Date(scoredSessions[0].startsAt) : null
  const raceSession = scoredSessions.find((s) => s.type === 'race')
  const preRaceDeadline = raceSession ? new Date(raceSession.startsAt) : null

  const otherMembers = (members ?? [])
    .filter((m) => m.user_id !== userId)
    .map((m) => {
      const profile = m.profiles
      return {
        userId: m.user_id,
        pseudo: profile?.pseudo ?? '?',
      }
    })

  const driverList = driversRaw.map((d) => ({
    id:        d.id,
    code:      d.code,
    firstName: d.first_name,
    lastName:  d.last_name,
    number:    d.number,
  }))

  const constructorList = constructorsRaw.map((c) => ({
    id:   c.id,
    code: c.code,
    name: c.name,
  }))

  const isSprintWeekend = gp.is_sprint_weekend
  // Fuseau épinglé via lib/dates : le rendu serveur (UTC sur Vercel) affichait
  // les deadlines d'items avec 2 h de retard — seul site oublié par #221.
  const formatDeadline = (d: Date) => formatParis(d, { dateStyle: 'short', timeStyle: 'short' })

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-8">

        {/* Header — le GP concerné est toujours affiché en évidence (jamais de report silencieux). */}
        <div className="flex flex-col gap-1">
          <Link
            href={`/leagues/${leagueId}/gp/${gpId}`}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← {gp.name}
          </Link>
          <h1 className="text-2xl font-bold text-white">Jouer un item — {gp.name}</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            {league.name} · Round {gp.round} · {gp.country}
          </p>
          {playability === 'open' && (
            <div className="text-sm text-zinc-400 mt-1 flex flex-col gap-0.5">
              {preQualifyingDeadline && (
                <span>Avant les qualifs : {formatDeadline(preQualifyingDeadline)}</span>
              )}
              {preRaceDeadline && (
                <span>Avant la course : {formatDeadline(preRaceDeadline)}</span>
              )}
            </div>
          )}
        </div>

        {/* GP futur — items pas encore ouverts */}
        {playability === 'future' && (
          <div className="bg-zinc-900 rounded-xl px-4 py-4">
            <p className="text-white font-medium">Pas encore disponible</p>
            <p className="text-zinc-500 text-sm mt-1">
              Tu ne peux jouer un item que sur le GP en cours. Reviens une fois le GP courant terminé.
            </p>
          </div>
        )}

        {/* GP passé / finalisé — fenêtre fermée */}
        {playability === 'past' && (
          <div className="bg-zinc-900 rounded-xl px-4 py-4">
            <p className="text-white font-medium">Fenêtre passée</p>
            <p className="text-zinc-500 text-sm mt-1">
              La période pour jouer un item sur ce GP est terminée.
            </p>
          </div>
        )}

        {/* Item déjà joué (slot hebdo consommé) */}
        {playability === 'open' && playedItem && (
          <div className="bg-zinc-900 rounded-xl px-4 py-4 flex flex-col gap-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Item joué</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ITEM_LABELS[playedItem.itemType]?.emoji ?? '🎮'}</span>
              <div>
                <p className="text-white font-medium">{ITEM_LABELS[playedItem.itemType]?.name ?? playedItem.itemType}</p>
                <PlayedItemSummary itemType={playedItem.itemType} payload={playedItem.payload} />
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              1 item par week-end — tu as déjà joué le tien. Révélé après la course.
            </p>
          </div>
        )}

        {/* Liste des items — GP courant. Slot libre : items jouables + indisponibles grisés.
            Slot pris : l'item joué est affiché ci-dessus, les autres apparaissent grisés. */}
        {playability === 'open' && (
          <PlayItemForm
            gpId={gpId}
            leagueId={leagueId}
            userItems={userItems}
            availability={availability}
            playedItemType={playedItem?.itemType ?? null}
            members={otherMembers}
            drivers={driverList}
            constructors={constructorList}
            sessionTypes={futureSessionTypes}
            isSprintWeekend={isSprintWeekend}
            itemLabels={ITEM_LABELS}
          />
        )}

      </div>
    </main>
  )
}

function PlayedItemSummary({
  itemType,
  payload,
}: {
  itemType: string
  payload:  Record<string, unknown>
}) {
  switch (itemType) {
    case 'shield':
      return <p className="text-sm text-zinc-400">Protection active pour ce GP</p>
    case 'block_driver':
      return (
        <p className="text-sm text-zinc-400">
          {payload.driver_code as string} verrouillé en {payload.session_type as string}
        </p>
      )
    case 'wild_card':
      return (
        <p className="text-sm text-zinc-400">
          Vol sur {payload.session_type as string}
        </p>
      )
    case 'double_points':
      return <p className="text-sm text-zinc-400">×2 en {payload.session_type as string}</p>
    case 'dnf_prediction':
    case 'underdog_top5':
      return <p className="text-sm text-zinc-400">{payload.driver_code as string}</p>
    case 'no_points_team':
      return <p className="text-sm text-zinc-400">{payload.constructor_code as string}</p>
    default:
      return null
  }
}
