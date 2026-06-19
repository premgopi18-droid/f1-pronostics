import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Interim response utilisé par Supabase pour propager les refreshes de token
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
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
  // Reconstruire le Cookie header depuis request.cookies (inclut les tokens refreshés).
  // Supprimer x-user-id côté client pour empêcher l'injection de header.
  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.set(
    'cookie',
    request.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join('; '),
  )
  forwardHeaders.delete('x-user-id')
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
