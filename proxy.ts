import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PENDING_INVITE_COOKIE, PENDING_INVITE_MAX_AGE, INVITE_CODE_PATTERN } from '@/lib/invites'
import {
  ONBOARDED_COOKIE,
  ONBOARDED_COOKIE_MAX_AGE,
  isOnboardedCookieValid,
} from '@/lib/auth/onboarding-cookie'

export async function proxy(request: NextRequest) {
  // Ne jamais faire confiance à un x-user-id entrant : c'est un header d'auth
  // interne, (ré)injecté plus bas uniquement après validation du JWT. On le supprime
  // des headers transmis sur TOUS les chemins de retour, y compris non authentifiés.
  const baseHeaders = new Headers(request.headers)
  baseHeaders.delete('x-user-id')

  // Interim response utilisé par Supabase pour propager les refreshes de token
  let supabaseResponse = NextResponse.next({ request: { headers: baseHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Garder request.cookies à jour (pour forwardHeaders ci-dessous)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: baseHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getClaims() vérifie la signature du JWT localement (#243) : le projet signe en
  // ES256 (clés asymétriques), le JWKS public est mis en cache 10 min par auth-js
  // (cache global, partagé entre requêtes d'une même instance). Un token expiré est
  // rafraîchi au passage (getSession sous-jacent → cookies posés via setAll). Plus
  // d'aller-retour réseau vers Auth à chaque navigation ; retombe automatiquement
  // sur getUser() (réseau) si le projet repassait en clés symétriques.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub ?? null

  const path = request.nextUrl.pathname
  const isPublicPath =
    // Ressources PWA : doivent rester publiques. Le navigateur récupère le manifest SANS
    // cookies (lien non-crédentialé), donc une requête authentifiée le verrait quand même
    // redirigé vers /login → l'app ne serait jamais installable. Le SW doit aussi être servi
    // en JS, pas en redirection. (Aussi exclus du matcher ci-dessous — défense en profondeur.)
    path === '/sw.js' ||
    path === '/manifest.webmanifest' ||
    path.startsWith('/login') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/f1') ||
    path.startsWith('/api/scores') ||
    // Endpoints admin : auth par CRON_SECRET (pas de session user) — ne doivent pas être
    // redirigés vers /login. ⚠️ Ce préfixe exempte TOUT `/api/admin/*` du gating de session :
    // tout endpoint ajouté ici DOIT s'authentifier lui-même (cf. isCronAuthorized dans
    // app/api/admin/announce/route.ts), sinon il est exposé sans session.
    path.startsWith('/api/admin') ||
    path.startsWith('/api/dev')

  if (!userId && !isPublicPath) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    // Parcours invité : un visiteur non connecté qui ouvre un lien d'invitation
    // (/leagues/join?code=…) verrait le code perdu au passage par /login. On le
    // garde dans un cookie ; il sera consommé après login/onboarding (auto-join).
    if (path === '/leagues/join') {
      const code = request.nextUrl.searchParams.get('code')
      if (code && INVITE_CODE_PATTERN.test(code)) {
        response.cookies.set(PENDING_INVITE_COOKIE, code, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: PENDING_INVITE_MAX_AGE,
        })
      }
    }
    return response
  }

  if (userId && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!userId) return supabaseResponse

  // Gating onboarding : tant que le compte n'est pas finalisé (pseudo + casque), on
  // le force vers /onboarding ; une fois finalisé, /onboarding renvoie vers la Home.
  // La lecture DB ne se fait qu'une fois par navigateur : dès qu'elle constate le
  // profil finalisé, un cookie (valeur = id utilisateur) la court-circuite ensuite
  // (#243). Fail-open : si la lecture échoue (ex. colonne absente avant migration),
  // on ne bloque pas l'app.
  let shouldSetOnboardedCookie = false
  if (!path.startsWith('/api')) {
    let completed: boolean | null = isOnboardedCookieValid(
      request.cookies.get(ONBOARDED_COOKIE)?.value,
      userId,
    )
      ? true
      : null

    if (completed === null) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single()
      if (!error && profile) {
        completed = profile.onboarding_completed === true
        shouldSetOnboardedCookie = completed
      }
    }

    if (completed === false && path !== '/onboarding') {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    if (completed === true && path === '/onboarding') {
      const response = NextResponse.redirect(new URL('/', request.url))
      if (shouldSetOnboardedCookie) setOnboardedCookie(response, userId)
      return response
    }
  }

  // Injecter x-user-id dans les headers de la requête transmise aux Server Components.
  // baseHeaders est déjà débarrassé de tout x-user-id client (cf. en-tête de fonction).
  // Reconstruire le Cookie header depuis request.cookies (inclut les tokens refreshés).
  const forwardHeaders = new Headers(baseHeaders)
  forwardHeaders.set(
    'cookie',
    request.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join('; '),
  )
  forwardHeaders.set('x-user-id', userId)

  const response = NextResponse.next({ request: { headers: forwardHeaders } })
  // Copier les cookies de réponse (tokens refreshés) depuis supabaseResponse
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) =>
    response.cookies.set(name, value, opts as Parameters<typeof response.cookies.set>[2]),
  )
  if (shouldSetOnboardedCookie) setOnboardedCookie(response, userId)
  return response
}

function setOnboardedCookie(response: NextResponse, userId: string) {
  response.cookies.set(ONBOARDED_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONBOARDED_COOKIE_MAX_AGE,
  })
}

export const config = {
  // sw.js et manifest.webmanifest sont exclus : ressources PWA publiques qui ne doivent jamais
  // être redirigées vers /login (sinon SW non enregistrable + manifest jamais chargé → app non
  // installable). Cf. isPublicPath dans proxy() pour la défense en profondeur.
  // `_vercel/*` (script et beacon Speed Insights, #244) : défense en profondeur seulement —
  // vérifié en prod, la plateforme sert ces chemins AVANT le proxy (200 sans session). En
  // SDK v2 le chemin réel peut être `/<seed>/script.js` (seed généré au build) : à contrôler
  // en DevTools après activation, déconnecté sur /login (200 attendu, pas 307).
  matcher: ['/((?!_next/static|_next/image|_vercel/|favicon\\.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
