import { UserAvatar } from '@/app/components/user-avatar'
import { Badge } from '@/app/ui/badge'
import { t, type TranslationKey } from '@/lib/i18n'
import { getCountryCode } from '@/lib/f1/country-codes'
import { getGpSubmissionStatus } from '@/lib/data/predictions'
import {
  buildReadinessRows,
  type ReadinessLightState,
  type ReadinessMember,
} from '@/lib/leagues/readiness'
import type { SessionType } from '@/lib/scoring/types'
import { cn } from '@/lib/utils'

const SESSION_LABEL_KEY: Record<SessionType, TranslationKey> = {
  qualifying: 'predict.tab.qualifying',
  race: 'predict.tab.race',
  sprint_qualifying: 'predict.tab.sprint_qualifying',
  sprint_race: 'predict.tab.sprint_race',
}

const LIGHT_LABEL_KEY: Record<ReadinessLightState, TranslationKey> = {
  submitted: 'leagueDetail.readinessStateSubmitted',
  missing: 'leagueDetail.readinessStateMissing',
  missed: 'leagueDetail.readinessStateMissed',
}

const AVATAR_SIZE = 28

/** Feu du boîtier : vert halo = envoyé · rouge pulsant = manquant · éteint = trop tard. */
const LIGHT_CLASS: Record<ReadinessLightState, string> = {
  submitted:
    'bg-success shadow-[0_0_8px_2px_color-mix(in_srgb,var(--success)_55%,transparent)]',
  missing: 'bg-destructive animate-[bx-light-pulse_2s_ease-in-out_infinite]',
  missed: 'bg-muted',
}

function formatSessionDay(startsAt: string): string {
  // Fuseau épinglé : rendu côté serveur (UTC sur Vercel), même raison que la deadline.
  return new Date(startsAt).toLocaleDateString('fr-FR', {
    weekday: 'short',
    timeZone: 'Europe/Paris',
  })
}

function ReadinessLight({ state }: { state: ReadinessLightState }) {
  return (
    <span className="mx-auto flex size-7 items-center justify-center rounded-full border border-border bg-background">
      <span aria-hidden className={cn('size-3.5 rounded-full', LIGHT_CLASS[state])} />
      <span className="sr-only">{t(LIGHT_LABEL_KEY[state])}</span>
    </span>
  )
}

/**
 * Bloc « Qui est prêt ? » (product-specs §7) : grille membres × sessions du GP
 * en cours / à venir, pastilles de soumission façon feux F1. N'affiche jamais le
 * contenu des pronos — uniquement soumis / pas soumis.
 */
export async function ReadinessSection({
  gp,
  members,
  currentUserId,
  nowMs,
}: {
  gp: {
    id: string
    name: string
    country: string
    circuit: string
    isSprintWeekend: boolean
    weekendStartsAt: string | null
  }
  /** Membres de la ligue, dans l'ordre d'affichage (classement). */
  members: ReadinessMember[]
  currentUserId: string
  nowMs: number
}) {
  const { sessions, submittedBySession } = await getGpSubmissionStatus(
    members.map((member) => member.userId),
    gp.id,
  )
  // Sessions pas encore synchronisées pour ce GP : rien à afficher.
  if (sessions.length === 0) return null

  const rows = buildReadinessRows(members, sessions, submittedBySession, nowMs)
  const weekendInProgress =
    gp.weekendStartsAt != null && new Date(gp.weekendStartsAt).getTime() <= nowMs

  return (
    <section aria-labelledby="readiness-heading">
      <h2
        id="readiness-heading"
        className="mb-3 text-2xs font-semibold uppercase tracking-widest text-primary-text"
      >
        {t('leagueDetail.readinessTitle')}
      </h2>

      <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4">
        {/* En-tête GP */}
        <div className="flex items-center gap-2.5">
          <span className="font-numeric text-sm font-bold text-text-secondary">
            {getCountryCode(gp.country)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{gp.name}</span>
            <span className="truncate text-2xs text-text-muted">
              {gp.circuit}
              {gp.isSprintWeekend && ` · ${t('leagueDetail.readinessSprintWeekend')}`}
            </span>
          </div>
          <Badge variant={weekendInProgress ? 'warning' : 'accent'} className="shrink-0">
            {weekendInProgress
              ? t('leagueDetail.readinessInProgress')
              : t('leagueDetail.gpStatusNext')}
          </Badge>
        </div>

        {/* Grille membres × sessions */}
        <table className="w-full table-fixed">
          <caption className="sr-only">{t('leagueDetail.readinessCaption')}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {sessions.map((session) => (
                <th key={session.id} scope="col" className="w-11 pb-1.5 align-bottom">
                  <span className="block text-2xs font-semibold leading-tight text-text-secondary">
                    {t(SESSION_LABEL_KEY[session.type])}
                  </span>
                  <span className="block text-2xs font-normal lowercase text-text-muted">
                    {formatSessionDay(session.startsAt)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, lights }) => (
              <tr key={member.userId}>
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      avatarKey={member.avatarKey}
                      avatarUrl={member.avatarUrl}
                      size={AVATAR_SIZE}
                      label={member.pseudo}
                    />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {member.userId === currentUserId ? t('compare.toi') : member.pseudo}
                    </span>
                  </span>
                </th>
                {lights.map((state, sessionIndex) => (
                  <td key={sessions[sessionIndex].id} className="py-1.5">
                    <ReadinessLight state={state} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Légende */}
        <div className="flex items-center justify-center gap-4 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-2xs text-text-muted">
            <span
              aria-hidden
              className="size-2 rounded-full bg-success shadow-[0_0_5px_1px_color-mix(in_srgb,var(--success)_50%,transparent)]"
            />
            {t('leagueDetail.readinessStateSubmitted')}
          </span>
          <span className="flex items-center gap-1.5 text-2xs text-text-muted">
            <span
              aria-hidden
              className="size-2 rounded-full bg-destructive shadow-[0_0_5px_1px_color-mix(in_srgb,var(--destructive)_50%,transparent)]"
            />
            {t('leagueDetail.readinessStateMissing')}
          </span>
          <span className="flex items-center gap-1.5 text-2xs text-text-muted">
            <span aria-hidden className="size-2 rounded-full bg-muted" />
            {t('leagueDetail.readinessStateMissed')}
          </span>
        </div>
      </div>
    </section>
  )
}
