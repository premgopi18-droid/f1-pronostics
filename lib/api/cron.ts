import 'server-only'
import { timingSafeEqual } from 'node:crypto'

// Helpers partagés par les routes cron (/api/f1/sync, /api/scores/trigger).

// Saison F1 courante — pilotée par l'env `F1_SEASON`, fallback sur l'année calendaire
// UTC. Évalué à chaque appel (pas de gel à l'instant du cold start). Un `F1_SEASON`
// non numérique retombe sur l'année courante plutôt que de propager un NaN silencieux.
export function getCurrentSeason(): number {
  const fromEnv = Number(process.env.F1_SEASON)
  return Number.isInteger(fromEnv) ? fromEnv : new Date().getUTCFullYear()
}

// Autorise une requête cron. Comparaison constant-time pour ne pas fuiter le secret par
// timing ; fail-closed si `CRON_SECRET` n'est pas défini.
// Deux sources acceptées :
//   • cron-job.org  → header `x-cron-secret: <CRON_SECRET>`
//   • Vercel crons  → header `Authorization: Bearer <CRON_SECRET>` (injecté automatiquement)
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const secretBuf = Buffer.from(secret)
  const matches = (value: string): boolean => {
    const buf = Buffer.from(value)
    return buf.length === secretBuf.length && timingSafeEqual(buf, secretBuf)
  }

  if (matches(request.headers.get('x-cron-secret') ?? '')) return true

  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ') && matches(authHeader.slice(7))) return true

  return false
}
