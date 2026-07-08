import { describe, it, expect } from "vitest";
import { formatCountdownLabel, remaining } from "./countdown";

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

describe("formatCountdownLabel", () => {
  it("compose une phrase complète depuis les valeurs de remaining", () => {
    expect(formatCountdownLabel({ days: 3, hours: 14, mins: 22 })).toBe("Départ dans 3 jours 14 heures 22 minutes");
  });

  it("garde les zéros et le pluriel invariable (pas d'omission)", () => {
    expect(formatCountdownLabel({ days: 0, hours: 0, mins: 1 })).toBe("Départ dans 0 jours 0 heures 1 minutes");
    expect(formatCountdownLabel({ days: 0, hours: 0, mins: 0 })).toBe("Départ dans 0 jours 0 heures 0 minutes");
  });

  it("cohérent avec remaining (composition bout à bout)", () => {
    const timeLeft = remaining(2 * DAY + 3 * HOUR + 15 * MIN, 0);
    expect(formatCountdownLabel(timeLeft)).toBe("Départ dans 2 jours 3 heures 15 minutes");
  });
});
