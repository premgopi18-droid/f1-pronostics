import { describe, it, expect } from "vitest";
import { leagueJoinStatus } from "./join-status";

describe("leagueJoinStatus", () => {
  it("open quand ouvert et place dispo", () => {
    expect(leagueJoinStatus(true, 7, 12)).toBe("open");
    expect(leagueJoinStatus(true, 0, 1)).toBe("open");
  });

  it("full quand le nombre max est atteint ou dépassé", () => {
    expect(leagueJoinStatus(true, 12, 12)).toBe("full");
    expect(leagueJoinStatus(true, 13, 12)).toBe("full");
  });

  it("closed prime sur full quand les inscriptions sont fermées", () => {
    expect(leagueJoinStatus(false, 5, 12)).toBe("closed");
    expect(leagueJoinStatus(false, 12, 12)).toBe("closed");
  });
});
