import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * - Refreshes the Supabase session cookie on every request.
 * - /admin/*    → only role='admin'
 * - /streamer/* → only role='streamer'
 * - /login      → redirect to /streamer/login (convenience)
 */
const REF_COOKIE = 'ls_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const REF_RE = /^[a-z0-9_-]{3,32}$/i;

function setRefCookie(res: NextResponse, ref: string) {
  res.cookies.set({
    name: REF_COOKIE,
    value: ref,
    maxAge: REF_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  });
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname } = request.nextUrl;

  // Capture ?ref= attribution (first-touch wins). Applied to the final response below.
  const refParam = request.nextUrl.searchParams.get('ref');
  // Last-touch wins: update the cookie whenever a ?ref= param is present.
  const refToSet =
    refParam && REF_RE.test(refParam)
      ? refParam.toLowerCase()
      : null;

  // Convenience redirect: /login → /streamer/login
  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/streamer/login';
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminArea = pathname.startsWith('/admin');
  const isAdminLogin = pathname === '/admin/login';
  const isStreamerArea = pathname.startsWith('/streamer');
  const isStreamerAuth =
    pathname === '/streamer/login' || pathname === '/streamer/register';

  // Unauthenticated guard
  if (isAdminArea && !isAdminLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }
  if (isStreamerArea && !isStreamerAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/streamer/login';
    url.searchParams.set('next', pathname);
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  // Role-based routing for authenticated users
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role;

    if (isAdminArea && !isAdminLogin && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = role === 'streamer' ? '/streamer' : '/streamer/login';
      url.search = '';
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    if (isStreamerArea && !isStreamerAuth && role !== 'streamer') {
      const url = request.nextUrl.clone();
      url.pathname = role === 'admin' ? '/admin' : '/streamer/login';
      url.search = '';
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    // Already-authenticated users hitting auth pages → bounce to their cabinet
    if (isAdminLogin && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    if (isStreamerAuth && role === 'streamer') {
      const url = request.nextUrl.clone();
      url.pathname = '/streamer';
      url.search = '';
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
  }

  if (refToSet) setRefCookie(response, refToSet);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
