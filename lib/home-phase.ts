/**
 * Phase de la Home pour le GP courant (le prochain GP non finalisé) :
 * - `upcoming`   : le week-end n'a pas commencé → card countdown ;
 * - `weekend`    : week-end en cours, aucune session live → card sessions ;
 * - `live`       : une session est en cours (démarrée, résultats non confirmés) ;
 * - `processing` : toutes les sessions confirmées, scoring pas encore finalisé.
 *
 * (L'état « résultats » correspond au GP finalisé → géré par la card « dernier GP ».)
 */
export type HomeGpPhase = "upcoming" | "weekend" | "live" | "processing";

export type SessionTiming = {
  startsAt: string;
  resultsConfirmedAt: string | null;
};

export function homeGpPhase(
  nowMs: number,
  weekendStartsAt: string | null,
  sessions: ReadonlyArray<SessionTiming>,
): HomeGpPhase {
  if (weekendStartsAt && nowMs < new Date(weekendStartsAt).getTime()) return "upcoming";
  if (sessions.length === 0) return weekendStartsAt ? "weekend" : "upcoming";

  const hasStarted = (s: SessionTiming) => nowMs >= new Date(s.startsAt).getTime();

  // Live : une session démarrée dont les résultats ne sont pas encore confirmés.
  if (sessions.some((s) => hasStarted(s) && s.resultsConfirmedAt === null)) return "live";

  // Toutes confirmées → en attente de finalisation du scoring.
  if (sessions.every((s) => s.resultsConfirmedAt !== null)) return "processing";

  return "weekend";
}

export type SessionLockState = "locked" | "open";

/** Une session verrouille les pronostics à son `startsAt`. */
export function sessionLockState(nowMs: number, startsAt: string): SessionLockState {
  return nowMs >= new Date(startsAt).getTime() ? "locked" : "open";
}

/** Session telle qu'affichée dans la card week-end de la Home. */
export type WeekendSession = { type: string; lockState: SessionLockState };
