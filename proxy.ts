import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Ne jamais faire confiance à un x-user-id entrant : c'est un header d'auth
  // interne, (ré)injecté plus bas uniquement après getUser(). On le supprime des
  // headers transmis sur TOUS les chemins de retour, y compris non authentifiés.
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

  // getUser() valide le JWT et déclenche un refresh si besoin.
  // C'est le seul appel auth réseau de tout le cycle de requête.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicPath =
    path.startsWith('/login') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/f1') ||
    path.startsWith('/api/scores')

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!user) return supabaseResponse

  // Injecter x-user-id dans les headers de la requête transmise aux Server Components.
  // baseHeaders est déjà débarrassé de tout x-user-id client (cf. en-tête de fonction).
  // Reconstruire le Cookie header depuis request.cookies (inclut les tokens refreshés).
  const forwardHeaders = new Headers(baseHeaders)
  forwardHeaders.set(
    'cookie',
    request.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join('; '),
  )
  forwardHeaders.set('x-user-id', user.id)

  const response = NextResponse.next({ request: { headers: forwardHeaders } })
  // Copier les cookies de réponse (tokens refreshés) depuis supabaseResponse
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) =>
    response.cookies.set(name, value, opts as Parameters<typeof response.cookies.set>[2]),
  )
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
