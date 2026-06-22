import { describe, it, expect } from "vitest";
import { validatePseudo } from "./pseudo";

describe("validatePseudo", () => {
  it("accepte un pseudo valide", () => {
    expect(validatePseudo("BoxBoxRomain")).toBeNull();
    expect(validatePseudo("max_33")).toBeNull();
    expect(validatePseudo("abc")).toBeNull();
    expect(validatePseudo("a".repeat(20))).toBeNull();
  });

  it("rejette une longueur hors bornes", () => {
    expect(validatePseudo("ab")).toBe("length");
    expect(validatePseudo("a".repeat(21))).toBe("length");
    expect(validatePseudo("")).toBe("length");
  });

  it("rejette les caractères interdits", () => {
    expect(validatePseudo("box box")).toBe("chars");
    expect(validatePseudo("héllo")).toBe("chars");
    expect(validatePseudo("max!")).toBe("chars");
    expect(validatePseudo("a-b-c")).toBe("chars");
  });

  it("priorise la longueur sur les caractères", () => {
    expect(validatePseudo("a!")).toBe("length");
  });
});
