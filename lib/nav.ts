/**
 * Logique de navigation — pure, sans dépendance React/Next, testable en isolation.
 * Utilisée par `BottomNav` ; vit ici pour pouvoir être couverte par Vitest (env node).
 */

/**
 * Un onglet correspond-il au chemin courant ?
 * `exact` → égalité stricte (sinon on inclut les sous-routes, ex. `/leagues/[id]`).
 * Le suffixe `/` évite les faux positifs de préfixe (`/leagues` ≠ `/leaguesXYZ`).
 */
export function isActiveRoute(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** La nav est-elle masquée sur ce chemin ? (préfixes de routes pré-authentification) */
export function isHiddenRoute(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
