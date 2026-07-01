import { describe, it, expect } from "vitest";
import {
  MAX_AVATAR_BYTES,
  validateAvatarFile,
  extensionForType,
  buildAvatarObjectPath,
  objectPathFromPublicUrl,
} from "./avatar-image";

describe("validateAvatarFile", () => {
  it("accepte une image sous la limite", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateAvatarFile({ type: "image/png", size: MAX_AVATAR_BYTES })).toBeNull();
  });

  it("rejette un fichier non-image", () => {
    expect(validateAvatarFile({ type: "application/pdf", size: 1024 })).toBe(
      "avatar.photo.errorNotImage",
    );
    expect(validateAvatarFile({ type: "", size: 1024 })).toBe("avatar.photo.errorNotImage");
  });

  it("rejette une image trop lourde", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: MAX_AVATAR_BYTES + 1 })).toBe(
      "avatar.photo.errorTooLarge",
    );
  });

  it("priorise le type sur la taille", () => {
    expect(validateAvatarFile({ type: "text/plain", size: MAX_AVATAR_BYTES + 1 })).toBe(
      "avatar.photo.errorNotImage",
    );
  });
});

describe("extensionForType", () => {
  it("mappe chaque type MIME produit vers son extension", () => {
    expect(extensionForType("image/webp")).toBe("webp");
    expect(extensionForType("image/png")).toBe("png");
    expect(extensionForType("image/jpeg")).toBe("jpg");
  });
});

describe("buildAvatarObjectPath", () => {
  it("préfixe par le dossier du user et suffixe par l'extension", () => {
    expect(buildAvatarObjectPath("user-123", "image/webp", "abc")).toBe("user-123/abc.webp");
    expect(buildAvatarObjectPath("user-123", "image/jpeg", "xyz")).toBe("user-123/xyz.jpg");
  });
});

describe("objectPathFromPublicUrl", () => {
  const base = "https://proj.supabase.co/storage/v1/object/public/avatars/";

  it("extrait le chemin d'une URL publique du bucket avatars", () => {
    expect(objectPathFromPublicUrl(`${base}user-1/photo.webp`)).toBe("user-1/photo.webp");
  });

  it("renvoie null pour une URL hors bucket ou vide", () => {
    expect(objectPathFromPublicUrl(null)).toBeNull();
    expect(objectPathFromPublicUrl("")).toBeNull();
    expect(objectPathFromPublicUrl("https://evil.example/pic.png")).toBeNull();
    expect(
      objectPathFromPublicUrl("https://proj.supabase.co/storage/v1/object/public/other/x.png"),
    ).toBeNull();
  });
});
