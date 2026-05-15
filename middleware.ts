import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicRoutes = [
  '/login',
  '/submit-report',
  '/api/assets/lookup',
]

// Define public route prefixes (for dynamic routes like /blog/[slug])
const publicPrefixes = [
  '/submit-report',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isAdminRoute = pathname.startsWith('/admin')
//  || pathname == "/assets" || pathname == "/assets/new"
  // Check if the route exactly matches a public route OR starts with a public prefix
  const isPublicRoute = publicRoutes.includes(pathname) || 
                        publicPrefixes.some(prefix => pathname.startsWith(prefix))

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicRoute) {
    // Save the original URL to redirect them back after logging in
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check admin role for /admin routes
  if (user && isAdminRoute) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileData?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
