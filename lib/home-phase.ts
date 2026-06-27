import { SCOREABLE_SESSION_TYPES, type SessionType } from "@/lib/scoring/types";

const SCOREABLE_TYPES = new Set<string>(SCOREABLE_SESSION_TYPES);

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
export type WeekendSession = { type: SessionType; lockState: SessionLockState };

/** Session brute du GP (type texte issu de la DB, EL comprises). */
export type RawGpSession = {
  type: string;
  startsAt: string;
  resultsConfirmedAt: string | null;
};

export type CurrentGpView = {
  phase: HomeGpPhase;
  sessions: WeekendSession[];
  /** Au moins une session du GP (EL comprises) a des résultats confirmés. */
  hasResults: boolean;
};

/**
 * Dérive la vue Home du GP courant à partir de ses sessions brutes. Pur — testable.
 *
 * Subtilité : `hasResults` regarde TOUTES les sessions (EL comprises, pour proposer
 * le lien « Résultats »), tandis que la phase et les sessions rendues n'utilisent
 * QUE les sessions scorées — inclure les essais fausserait la phase (une EL en
 * cours basculerait la Home en « live ») et le rendu n'a pas de label pour les EL.
 */
export function deriveCurrentGpView(
  nowMs: number,
  weekendStartsAt: string | null,
  sessions: ReadonlyArray<RawGpSession>,
): CurrentGpView {
  const hasResults = sessions.some((s) => s.resultsConfirmedAt !== null);
  const scoreable = sessions.filter((s) => SCOREABLE_TYPES.has(s.type));

  const phase = homeGpPhase(
    nowMs,
    weekendStartsAt,
    scoreable.map((s) => ({ startsAt: s.startsAt, resultsConfirmedAt: s.resultsConfirmedAt })),
  );

  return {
    phase,
    hasResults,
    sessions: scoreable.map((s) => ({
      type: s.type as SessionType,
      lockState: sessionLockState(nowMs, s.startsAt),
    })),
  };
}
