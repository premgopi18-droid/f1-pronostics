import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes use their own auth (CRON_SECRET) — skip middleware
  if (pathname.startsWith('/api')) return NextResponse.next()

  // Interim response used by Supabase to propagate cookie refreshes
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Keep request cookies up-to-date (for forwardHeaders below)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Recreate response so cookie mutations propagate to the browser
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT and triggers a token refresh when needed.
  // This is the single auth network call for the entire request lifecycle.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!user) return supabaseResponse

  // Build forwarded request headers:
  //   1. Rebuild Cookie header from request.cookies (includes any refreshed tokens)
  //   2. Strip any client-supplied x-user-id (prevents header injection)
  //   3. Inject x-user-id so Server Components skip their own getUser() call
  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.set(
    'cookie',
    request.cookies.getAll().map(({ name, value }) => `${name}=${value}`).join('; '),
  )
  forwardHeaders.delete('x-user-id')
  forwardHeaders.set('x-user-id', user.id)

  const response = NextResponse.next({ request: { headers: forwardHeaders } })
  // Copy browser-facing cookies (refreshed tokens, etc.) from supabaseResponse
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) =>
    response.cookies.set(name, value, opts as Parameters<typeof response.cookies.set>[2])
  )
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
