import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Middleware responsibilities:
 * - Refresh Supabase session cookie on every request.
 * - /admin/*    → only role='admin'  (from profiles table)
 * - /streamer/* → only role='streamer' AND not a manager
 * - /manager/*  → only users who have a row in managers table
 * - /login      → redirect to /streamer/login (convenience)
 *
 * Manager users have profiles.role='streamer' (enum limitation) but also
 * have a row in the managers table. We detect them by checking managers table.
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
  const { pathname } = request.nextUrl;

  // Pass current pathname downstream so layouts can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Capture ?ref= attribution
  const refParam = request.nextUrl.searchParams.get('ref');
  const refToSet =
    refParam && REF_RE.test(refParam) ? refParam.toLowerCase() : null;

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

  // Route classification
  const isAdminArea    = pathname.startsWith('/admin');
  const isAdminLogin   = pathname === '/admin/login';
  const isStreamerArea = pathname.startsWith('/streamer');
  const isStreamerAuth = pathname === '/streamer/login' || pathname === '/streamer/register';
  const isManagerArea  = pathname.startsWith('/manager');
  const isManagerLogin = pathname === '/manager/login';

  // ── Unauthenticated guard ──────────────────────────────────────────────────
  if (!user) {
    if (isAdminArea && !isAdminLogin) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    if (isStreamerArea && !isStreamerAuth) {
      const url = request.nextUrl.clone();
      url.pathname = '/streamer/login';
      url.searchParams.set('next', pathname);
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    if (isManagerArea && !isManagerLogin) {
      const url = request.nextUrl.clone();
      url.pathname = '/manager/login';
      url.searchParams.set('next', pathname);
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    if (refToSet) setRefCookie(response, refToSet);
    return response;
  }

  // ── Authenticated: resolve role ────────────────────────────────────────────
  // 1. Check profiles table for admin/streamer role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const profileRole = profile?.role; // 'admin' | 'streamer' | null

  // 2. Check if this user is a manager (has a row in managers table)
  //    Managers have profiles.role='streamer' due to enum limitation.
  //    We must check managers table to distinguish them from real streamers.
  let isManager = false;
  if (profileRole === 'streamer') {
    const { data: managerRow } = await supabase
      .from('managers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    isManager = !!managerRow;
  }

  // Effective role for routing
  const effectiveRole = profileRole === 'admin'
    ? 'admin'
    : isManager
      ? 'manager'
      : 'streamer';

  // ── Admin area ─────────────────────────────────────────────────────────────
  if (isAdminArea) {
    if (isAdminLogin) {
      // Already logged in as admin → bounce to dashboard
      if (effectiveRole === 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/admin';
        url.search = '';
        const r = NextResponse.redirect(url);
        if (refToSet) setRefCookie(r, refToSet);
        return r;
      }
      // Non-admin on login page → let them see the login form (they'll fail auth)
      if (refToSet) setRefCookie(response, refToSet);
      return response;
    }
    // Protected admin pages
    if (effectiveRole !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = effectiveRole === 'manager' ? '/manager' : '/streamer/login';
      url.search = '';
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
  }

  // ── Streamer area ──────────────────────────────────────────────────────────
  if (isStreamerArea) {
    if (isStreamerAuth) {
      // Already logged in → bounce to their area
      if (effectiveRole === 'streamer') {
        const url = request.nextUrl.clone();
        url.pathname = '/streamer';
        url.search = '';
        const r = NextResponse.redirect(url);
        if (refToSet) setRefCookie(r, refToSet);
        return r;
      }
      if (effectiveRole === 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/admin';
        url.search = '';
        const r = NextResponse.redirect(url);
        if (refToSet) setRefCookie(r, refToSet);
        return r;
      }
      if (effectiveRole === 'manager') {
        const url = request.nextUrl.clone();
        url.pathname = '/manager';
        url.search = '';
        const r = NextResponse.redirect(url);
        if (refToSet) setRefCookie(r, refToSet);
        return r;
      }
    }
    // Protected streamer pages — managers must NOT access /streamer/*
    if (effectiveRole !== 'streamer') {
      const url = request.nextUrl.clone();
      url.pathname = effectiveRole === 'admin' ? '/admin' : '/manager';
      url.search = '';
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
  }

  // ── Manager area ───────────────────────────────────────────────────────────
  if (isManagerArea) {
    if (isManagerLogin) {
      // Already logged in as manager → bounce to dashboard
      if (effectiveRole === 'manager') {
        const url = request.nextUrl.clone();
        url.pathname = '/manager';
        url.search = '';
        const r = NextResponse.redirect(url);
        if (refToSet) setRefCookie(r, refToSet);
        return r;
      }
      if (effectiveRole === 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/admin';
        url.search = '';
        const r = NextResponse.redirect(url);
        if (refToSet) setRefCookie(r, refToSet);
        return r;
      }
      // Non-manager on manager login → let them see the form
      if (refToSet) setRefCookie(response, refToSet);
      return response;
    }
    // Protected manager pages
    if (effectiveRole !== 'manager') {
      const url = request.nextUrl.clone();
      url.pathname = effectiveRole === 'admin' ? '/admin' : '/manager/login';
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
