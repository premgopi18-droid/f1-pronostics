import { describe, it, expect } from "vitest";
import { rawGpScore } from "./gp-score";

describe("rawGpScore", () => {
  it("somme une seule occurrence par session", () => {
    expect(
      rawGpScore([
        { sessionId: "quali", baseScore: 80 },
        { sessionId: "race", baseScore: 120 },
      ]),
    ).toBe(200);
  });

  it("déduplique les sessions répétées (plusieurs ligues)", () => {
    expect(
      rawGpScore([
        { sessionId: "race", baseScore: 120 },
        { sessionId: "race", baseScore: 120 }, // même session, autre ligue
        { sessionId: "quali", baseScore: 80 },
      ]),
    ).toBe(200);
  });

  it("renvoie 0 sans ligne", () => {
    expect(rawGpScore([])).toBe(0);
  });
});
