'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export type Standing = {
  user_id:  string
  is_admin: boolean
  profile:  { pseudo: string; avatarKey: string | null; isDeleted: boolean }
  total:    number
  exact:    number
}

export type MemberRow = {
  user_id:  string
  is_admin: boolean
  profile:  { pseudo: string; avatarKey: string | null; isDeleted: boolean }
}

export type ScoreRow = {
  user_id:         string
  final_score:     number
  exact_positions: number
}

export type SeasonScoreRow = {
  user_id: string
  total:   number
}

// Agrège les scores de session + bonus saison par user et trie le classement.
// Source unique : appelé côté serveur (SSR) dans page.tsx et côté client à chaque event Realtime.
export function buildStandings(
  members:      MemberRow[],
  scoreRows:    ScoreRow[],
  seasonRows:   SeasonScoreRow[],
): Standing[] {
  const totalByUser = new Map<string, number>()
  const exactByUser = new Map<string, number>()

  for (const row of scoreRows) {
    totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + (row.final_score ?? 0))
    exactByUser.set(row.user_id, (exactByUser.get(row.user_id) ?? 0) + (row.exact_positions ?? 0))
  }
  for (const row of seasonRows) {
    totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + (row.total ?? 0))
  }

  return members
    .map((m) => ({
      user_id:  m.user_id,
      is_admin: m.is_admin,
      profile:  m.profile,
      total:    totalByUser.get(m.user_id) ?? 0,
      exact:    exactByUser.get(m.user_id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.profile.isDeleted !== b.profile.isDeleted) return a.profile.isDeleted ? 1 : -1
      if (b.total !== a.total) return b.total - a.total
      return b.exact - a.exact
    })
}

export function LeaderboardRealtime({
  initialStandings,
  members,
  seasonScores,
  leagueId,
  season,
  currentUserId,
}: {
  initialStandings: Standing[]
  members:          MemberRow[]
  seasonScores:     SeasonScoreRow[]
  leagueId:         string
  season:           number
  currentUserId:    string
}) {
  const [standings, setStandings] = useState(initialStandings)
  const [isLive, setIsLive]       = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    const refresh = async () => {
      const { data } = await supabase
        .from('scores')
        .select('user_id, final_score, exact_positions')
        .eq('league_id', leagueId)
        .eq('season', season)

      if (data) {
        setStandings(buildStandings(members, data as ScoreRow[], seasonScores))
      }
    }

    const channel = supabase
      .channel(`league-scores-${leagueId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'scores',
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          // Le scoring upsert 1 ligne `scores` par membre → 1 event par membre. On debounce
          // pour coalescer cette rafale en un seul re-fetch + ré-agrégation.
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(refresh, 300)
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [leagueId, season, members, seasonScores])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Classement</h2>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            En direct
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {standings.map((member, index) => (
          <div
            key={member.user_id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              member.user_id === currentUserId ? 'bg-zinc-800' : 'bg-zinc-900'
            } ${member.profile.isDeleted ? 'opacity-50' : ''}`}
          >
            <span className="text-zinc-500 text-sm w-5 text-right">{index + 1}</span>
            <span className={`flex-1 font-medium ${member.profile.isDeleted ? 'text-zinc-500' : 'text-white'}`}>
              {member.profile.pseudo}
              {member.is_admin && <span className="ml-2 text-xs text-zinc-500">admin</span>}
            </span>
            <span className="text-white font-semibold tabular-nums">{member.total} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}
