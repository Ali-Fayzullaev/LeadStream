import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Middleware responsibilities:
 * - Refresh Supabase session cookie on every request.
 * - /admin/*   → only role='admin'
 * - /streamer/* → only streamers
 * - /manager/* → only managers
 * - /broker/*  → only brokers
 * - /login     → unified login (redirect if already logged in)
 */

const REF_COOKIE = 'ls_ref';
const REF_MAX_AGE = 60 * 60 * 24 * 30;
const REF_RE = /^[a-z0-9_-]{3,32}$/i;

function setRefCookie(res: NextResponse, ref: string) {
  res.cookies.set({ name: REF_COOKIE, value: ref, maxAge: REF_MAX_AGE, path: '/', sameSite: 'lax', httpOnly: false });
}

/**
 * Query Supabase REST API directly using service_role key.
 * Works in both Edge and Node.js runtimes.
 */
async function querySupabaseRest(
  table: string,
  filter: string,
  select: string = 'id',
): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/${table}?${filter}&select=${select}&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const refParam = request.nextUrl.searchParams.get('ref');
  const refToSet = refParam && REF_RE.test(refParam) ? refParam.toLowerCase() : null;

  // Session client (anon key) — only for auth.getUser()
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

  const { data: { user } } = await supabase.auth.getUser();

  const isAdminArea    = pathname.startsWith('/admin');
  const isAdminLogin   = pathname === '/admin/login';
  const isStreamerArea = pathname.startsWith('/streamer');
  const isStreamerAuth = pathname === '/streamer/login' || pathname === '/streamer/register';
  const isManagerArea  = pathname.startsWith('/manager');
  const isManagerLogin = pathname === '/manager/login';
  const isBrokerArea   = pathname.startsWith('/broker');
  const isBrokerLogin  = pathname === '/broker/login';
  const isUnifiedLogin = pathname === '/login';

  // ── Unauthenticated guard ──────────────────────────────────────────────────
  if (!user) {
    if ((isAdminArea && !isAdminLogin) ||
        (isStreamerArea && !isStreamerAuth) ||
        (isManagerArea && !isManagerLogin) ||
        (isBrokerArea && !isBrokerLogin)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      const r = NextResponse.redirect(url);
      if (refToSet) setRefCookie(r, refToSet);
      return r;
    }
    if (refToSet) setRefCookie(response, refToSet);
    return response;
  }

  // ── Authenticated: resolve role via REST API (bypasses RLS) ───────────────
  const uid = encodeURIComponent(user.id);

  // Get profile role
  let profileRole: string | undefined;
  const profileRow = await querySupabaseRest('profiles', `id=eq.${uid}`, 'role');
  profileRole = (profileRow?.role as string) ?? undefined;

  // Check broker
  let isBroker = false;
  const brokerRow = await querySupabaseRest('brokers', `user_id=eq.${uid}`, 'id');
  isBroker = !!brokerRow;

  // Check manager
  let isManager = false;
  const managerRow = await querySupabaseRest('managers', `user_id=eq.${uid}`, 'id');
  isManager = !!managerRow;

  const effectiveRole = profileRole === 'admin'
    ? 'admin'
    : isBroker
      ? 'broker'
      : isManager
        ? 'manager'
        : 'streamer';

  // ── Unified login: redirect to correct area ────────────────────────────────
  if (isUnifiedLogin || isAdminLogin || isManagerLogin || isBrokerLogin || isStreamerAuth) {
    const dest = effectiveRole === 'admin' ? '/admin'
      : effectiveRole === 'broker' ? '/broker'
      : effectiveRole === 'manager' ? '/manager'
      : '/streamer';
    const url = request.nextUrl.clone();
    url.pathname = dest;
    url.search = '';
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  // ── Admin area ─────────────────────────────────────────────────────────────
  if (isAdminArea && effectiveRole !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = effectiveRole === 'manager' ? '/manager'
      : effectiveRole === 'broker' ? '/broker'
      : '/streamer';
    url.search = '';
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  // ── Streamer area ──────────────────────────────────────────────────────────
  if (isStreamerArea && effectiveRole !== 'streamer') {
    const url = request.nextUrl.clone();
    url.pathname = effectiveRole === 'admin' ? '/admin'
      : effectiveRole === 'broker' ? '/broker'
      : '/manager';
    url.search = '';
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  // ── Manager area ───────────────────────────────────────────────────────────
  if (isManagerArea && effectiveRole !== 'manager') {
    const url = request.nextUrl.clone();
    url.pathname = effectiveRole === 'admin' ? '/admin'
      : effectiveRole === 'broker' ? '/broker'
      : '/login';
    url.search = '';
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  // ── Broker area ────────────────────────────────────────────────────────────
  if (isBrokerArea && effectiveRole !== 'broker') {
    const url = request.nextUrl.clone();
    url.pathname = effectiveRole === 'admin' ? '/admin'
      : effectiveRole === 'manager' ? '/manager'
      : '/login';
    url.search = '';
    const r = NextResponse.redirect(url);
    if (refToSet) setRefCookie(r, refToSet);
    return r;
  }

  if (refToSet) setRefCookie(response, refToSet);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
