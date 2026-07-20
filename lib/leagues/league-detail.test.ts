import { describe, it, expect } from "vitest";
import { findUpcomingGp, findCurrentOrLastGp, findCurrentItemsGp, getLastFinalizedGps } from "./league-detail";
import type { GrandPrixSummary } from "./league-detail";

const gp = (
  round: number,
  weekendStartsAt: string,
  scoringFinalizedAt: string | null = null,
): GrandPrixSummary => ({
  id: `gp-${round}`,
  name: `GP ${round}`,
  country: "Monaco",
  round,
  weekend_starts_at: weekendStartsAt,
  scoring_finalized_at: scoringFinalizedAt,
});

const NOW = new Date("2026-06-01T12:00:00Z");

describe("findUpcomingGp", () => {
  it("retourne le GP le plus proche dans le futur", () => {
    const gps = [gp(5, "2026-06-10T10:00:00Z"), gp(6, "2026-06-17T10:00:00Z")];
    expect(findUpcomingGp(gps, NOW)?.round).toBe(5);
  });

  it("retourne null si tous les GPs sont passés", () => {
    const gps = [gp(1, "2026-05-01T10:00:00Z"), gp(2, "2026-05-15T10:00:00Z")];
    expect(findUpcomingGp(gps, NOW)).toBeNull();
  });

  it("retourne null pour un tableau vide", () => {
    expect(findUpcomingGp([], NOW)).toBeNull();
  });

  it("choisit le plus proche parmi plusieurs GPs futurs", () => {
    const gps = [gp(7, "2026-06-20T10:00:00Z"), gp(6, "2026-06-10T10:00:00Z")];
    expect(findUpcomingGp(gps, NOW)?.round).toBe(6);
  });

  it("n'inclut pas un GP dont le weekend commence exactement à now", () => {
    const gps = [gp(5, "2026-06-01T12:00:00Z")];
    expect(findUpcomingGp(gps, NOW)).toBeNull();
  });
});

describe("findCurrentOrLastGp", () => {
  it("retourne le GP en cours quand un weekend a commencé", () => {
    const gps = [
      gp(4, "2026-05-25T10:00:00Z"),
      gp(5, "2026-06-01T08:00:00Z"), // commencé avant NOW
      gp(6, "2026-06-15T10:00:00Z"), // futur
    ];
    expect(findCurrentOrLastGp(gps, NOW)?.round).toBe(5);
  });

  it("retourne le dernier GP passé si aucun weekend en cours", () => {
    const gps = [gp(1, "2026-05-01T10:00:00Z"), gp(2, "2026-05-15T10:00:00Z")];
    expect(findCurrentOrLastGp(gps, NOW)?.round).toBe(2);
  });

  it("inclut un GP dont le weekend commence exactement à now", () => {
    const gps = [gp(5, "2026-06-01T12:00:00Z")];
    expect(findCurrentOrLastGp(gps, NOW)?.round).toBe(5);
  });

  it("retourne null si la saison n'a pas démarré", () => {
    const gps = [gp(1, "2026-07-01T10:00:00Z")];
    expect(findCurrentOrLastGp(gps, NOW)).toBeNull();
  });

  it("retourne null pour un tableau vide", () => {
    expect(findCurrentOrLastGp([], NOW)).toBeNull();
  });
});

describe("findCurrentItemsGp", () => {
  it("retourne le premier GP non finalisé, même si son weekend a commencé", () => {
    // Scénario du bug : weekend du round 10 en cours (commencé avant NOW),
    // round 11 futur — le bouton items doit cibler le round 10, pas le 11.
    const gps = [
      gp(9, "2026-05-15T10:00:00Z", "2026-05-17T18:00:00Z"),
      gp(10, "2026-06-01T08:00:00Z"), // weekend commencé, pas finalisé
      gp(11, "2026-06-15T10:00:00Z"),
    ];
    expect(findCurrentItemsGp(gps)?.round).toBe(10);
  });

  it("retourne le prochain GP quand le précédent est finalisé", () => {
    const gps = [
      gp(10, "2026-06-01T08:00:00Z", "2026-06-01T16:00:00Z"),
      gp(11, "2026-06-15T10:00:00Z"),
    ];
    expect(findCurrentItemsGp(gps)?.round).toBe(11);
  });

  it("choisit le plus petit round parmi les non finalisés, quel que soit l'ordre du tableau", () => {
    const gps = [gp(12, "2026-07-01T10:00:00Z"), gp(11, "2026-06-15T10:00:00Z")];
    expect(findCurrentItemsGp(gps)?.round).toBe(11);
  });

  it("retourne null quand toute la saison est finalisée", () => {
    const gps = [gp(1, "2026-03-01T10:00:00Z", "2026-03-03T20:00:00Z")];
    expect(findCurrentItemsGp(gps)).toBeNull();
  });

  it("retourne null pour un tableau vide", () => {
    expect(findCurrentItemsGp([])).toBeNull();
  });
});

describe("getLastFinalizedGps", () => {
  it("retourne les derniers GPs finalisés dans l'ordre round décroissant", () => {
    const gps = [
      gp(1, "2026-03-01T10:00:00Z", "2026-03-03T20:00:00Z"),
      gp(2, "2026-04-01T10:00:00Z", "2026-04-03T20:00:00Z"),
      gp(3, "2026-05-01T10:00:00Z", "2026-05-03T20:00:00Z"),
      gp(4, "2026-06-01T10:00:00Z"),
    ];
    const result = getLastFinalizedGps(gps, 2);
    expect(result.map((g) => g.round)).toEqual([3, 2]);
  });

  it("retourne un tableau vide si aucun GP finalisé", () => {
    expect(getLastFinalizedGps([gp(1, "2026-03-01T10:00:00Z")], 3)).toHaveLength(0);
  });

  it("retourne au maximum `limit` éléments", () => {
    const gps = Array.from({ length: 5 }, (_, i) =>
      gp(i + 1, `2026-0${i + 1}-01T10:00:00Z`, `2026-0${i + 1}-03T20:00:00Z`),
    );
    expect(getLastFinalizedGps(gps, 3)).toHaveLength(3);
  });

  it("exclut les GPs dont scoring_finalized_at est null", () => {
    const gps = [
      gp(1, "2026-03-01T10:00:00Z", "2026-03-03T20:00:00Z"),
      gp(2, "2026-04-01T10:00:00Z"),
    ];
    const result = getLastFinalizedGps(gps, 5);
    expect(result).toHaveLength(1);
    expect(result[0].round).toBe(1);
  });
});
