'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { buildStandings } from '@/lib/leagues/standings'
import { getHelmet, DEFAULT_HELMET } from '@/lib/profile/avatars'
import { AvatarHelmet } from '@/app/ui/avatar-helmet'
import { Badge } from '@/app/ui/badge'
import { t } from '@/lib/i18n'
import type { Standing, MemberRow, ScoreRow, SeasonScoreRow } from '@/lib/leagues/standings'

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

  const maxScore = Math.max(...standings.map((s) => s.total), 1)

  return (
    <section aria-labelledby="leaderboard-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="leaderboard-heading"
          className="text-2xs font-semibold uppercase tracking-widest text-primary-text"
        >
          {t('leagueDetail.leaderboardTitle')}
        </h2>
        {isLive && (
          <span className="flex items-center gap-1.5 text-2xs text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />
            {t('leagueDetail.liveLabel')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5" role="list">
        {standings.map((member, index) => {
          const isCurrentUser = member.user_id === currentUserId
          const helmet = getHelmet(member.profile.avatarKey) ?? DEFAULT_HELMET
          const barPercent = Math.round((member.total / maxScore) * 100)

          return (
            <div
              key={member.user_id}
              role="listitem"
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5',
                isCurrentUser ? 'bg-accent-soft' : 'bg-card',
              )}
            >
              <span className="w-5 shrink-0 text-right font-numeric text-sm tabular-nums text-text-muted">
                {index + 1}
              </span>

              <AvatarHelmet
                color={helmet.color}
                size={32}
                label={member.profile.pseudo}
                className={cn(isCurrentUser && 'ring-2 ring-primary ring-offset-1 ring-offset-transparent')}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {isCurrentUser ? t('compare.toi') : member.profile.pseudo}
                  </span>
                  {member.is_admin && (
                    <Badge variant="gold" className="shrink-0">
                      {t('leagues.adminBadge')}
                    </Badge>
                  )}
                </div>
                {/* Barre de progression proportionnelle au score */}
                <div className="h-0.5 w-full rounded-full bg-white/5" aria-hidden>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barPercent}%`, backgroundColor: helmet.color }}
                  />
                </div>
              </div>

              <span
                className={cn(
                  'shrink-0 font-numeric text-sm font-bold tabular-nums',
                  isCurrentUser ? 'text-gold' : 'text-foreground',
                )}
              >
                {member.total}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
