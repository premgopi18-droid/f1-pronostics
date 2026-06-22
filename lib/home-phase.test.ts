import { describe, it, expect } from "vitest";
import { homeGpPhase, sessionLockState, type SessionTiming } from "./home-phase";

const T0 = Date.parse("2026-06-01T00:00:00Z");
const h = (n: number) => T0 + n * 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("homeGpPhase", () => {
  const weekend = iso(h(10));

  it("upcoming avant le début du week-end", () => {
    expect(homeGpPhase(h(0), weekend, [])).toBe("upcoming");
  });

  it("live si une session est démarrée et non confirmée", () => {
    const sessions: SessionTiming[] = [
      { startsAt: iso(h(11)), resultsConfirmedAt: iso(h(12)) },
      { startsAt: iso(h(13)), resultsConfirmedAt: null },
    ];
    expect(homeGpPhase(h(13), weekend, sessions)).toBe("live");
  });

  it("weekend : démarré, sessions à venir, aucune live", () => {
    const sessions: SessionTiming[] = [{ startsAt: iso(h(20)), resultsConfirmedAt: null }];
    expect(homeGpPhase(h(11), weekend, sessions)).toBe("weekend");
  });

  it("processing : toutes les sessions confirmées", () => {
    const sessions: SessionTiming[] = [
      { startsAt: iso(h(11)), resultsConfirmedAt: iso(h(12)) },
      { startsAt: iso(h(13)), resultsConfirmedAt: iso(h(14)) },
    ];
    expect(homeGpPhase(h(15), weekend, sessions)).toBe("processing");
  });

  it("weekend par défaut si pas de date de week-end mais des sessions", () => {
    expect(homeGpPhase(h(0), null, [{ startsAt: iso(h(20)), resultsConfirmedAt: null }])).toBe(
      "weekend",
    );
  });

  it("upcoming si ni date de week-end ni sessions", () => {
    expect(homeGpPhase(h(0), null, [])).toBe("upcoming");
  });
});

describe("sessionLockState", () => {
  it("locked une fois la session démarrée", () => {
    expect(sessionLockState(h(5), iso(h(4)))).toBe("locked");
    expect(sessionLockState(h(4), iso(h(4)))).toBe("locked");
  });
  it("open tant que la session n'a pas démarré", () => {
    expect(sessionLockState(h(3), iso(h(4)))).toBe("open");
  });
});
