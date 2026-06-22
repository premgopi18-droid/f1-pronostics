import { describe, it, expect } from "vitest";
import { remaining } from "./countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("remaining", () => {
  it("décompose jours / heures / minutes", () => {
    const now = 0;
    expect(remaining(2 * DAY + 3 * HOUR + 15 * MIN, now)).toEqual({ days: 2, hours: 3, mins: 15 });
  });

  it("tronque les secondes (minute entamée non comptée)", () => {
    expect(remaining(5 * MIN + 59_000, 0)).toEqual({ days: 0, hours: 0, mins: 5 });
  });

  it("borne à zéro quand la cible est passée", () => {
    expect(remaining(-DAY, 0)).toEqual({ days: 0, hours: 0, mins: 0 });
    expect(remaining(0, 0)).toEqual({ days: 0, hours: 0, mins: 0 });
  });
});
