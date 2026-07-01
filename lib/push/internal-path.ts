// Restreint une URL de notification à un chemin INTERNE. Le service worker fait
// `clients.openWindow(url)` au clic : un chemin absolu (`https://…`) ou protocol-relative
// (`//host`) ouvrirait un domaine externe (phishing). On n'accepte donc qu'un chemin
// commençant par `/` mais pas `//` ; toute autre valeur retombe sur `fallback`.
export function toInternalPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback
}
