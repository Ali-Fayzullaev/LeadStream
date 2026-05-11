import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { slimAuthCookiesInPlace } from '@/lib/supabase/cookie-slim';

/**
 * Returns true for any auth error that means "the refresh token is dead".
 * We treat these as "user is anonymous" instead of crashing the request.
 */
function isAuthRefreshError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; name?: string; code?: string };
  if (e.status === 400 || e.status === 401) return true;
  if (typeof e.code === 'string' && /refresh.*token|invalid.*token|jwt|session/i.test(e.code)) return true;
  if (typeof e.message === 'string' && /refresh.*token|invalid.*token|jwt|session/i.test(e.message)) return true;
  return false;
}

/**
 * Try to wipe Supabase auth cookies from the current request store.
 * In a Server Component the cookie store is read-only and `set()` throws —
 * we silently ignore. Middleware will clean cookies on the next request.
 */
function tryClearAuthCookies(): void {
  try {
    const store = cookies();
    for (const c of store.getAll()) {
      if (c.name.startsWith('sb-') || c.name.includes('-auth-token')) {
        try {
          store.set(c.name, '', { maxAge: 0, path: '/' });
        } catch {
          /* read-only context — middleware will fix it */
        }
      }
    }
  } catch {
    /* nothing to do */
  }
}

/**
 * Creates a Supabase server client whose `auth.getUser()` / `auth.getSession()`
 * NEVER throw on a stale refresh-token. They return `{ data: { user/session: null }, error: null }`
 * so all existing callers (`const { data: { user } } = await supabase.auth.getUser()`)
 * keep working — they just see an anonymous user instead of crashing the request.
 *
 * This is the single most important defence against 502 Bad Gateway from
 * "AuthApiError: Invalid Refresh Token".
 */
export function createClient(): SupabaseClient {
  const cookieStore = cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // CRITICAL on the server: do NOT keep a background timer that tries
        // to refresh the access token. Refresh on the server would just
        // mutate cookies that have already been sent — and worse, it
        // schedules a `setTimeout` that fires AFTER the request is gone,
        // producing the dreaded `unhandledRejection: AuthApiError: Invalid
        // Refresh Token` that crashes the Node process under PM2 and makes
        // nginx return 502.
        //
        // The browser (`lib/supabase/client.ts`) takes care of refresh; the
        // server only READS the user from the cookie that the browser
        // already negotiated.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            // Strip the bulky `user` object from `sb-*-auth-token` cookies
            // before persisting. Keeps the cookie ≤ ~1 KB so the combined
            // request Cookie header never overflows nginx' buffer and we
            // never serve 502 Bad Gateway because of fat cookies.
            const slimmed = slimAuthCookiesInPlace(cookiesToSet);
            slimmed.forEach(({ name, value, options }) => {
              // Force a long-lived cookie so the browser keeps the session
              // even after the laptop sleeps for days. Supabase by default
              // uses sessionCookies (no maxAge), which on some browsers are
              // discarded too aggressively → "Invalid Refresh Token".
              const enriched: CookieOptions = {
                ...(options as CookieOptions),
                maxAge: (options as CookieOptions).maxAge ?? 60 * 60 * 24 * 365, // 1 year
                sameSite: (options as CookieOptions).sameSite ?? 'lax',
                path: (options as CookieOptions).path ?? '/',
              };
              cookieStore.set(name, value, enriched);
            });
          } catch {
            // Server Component — ignored; middleware refreshes the session.
          }
        },
      },
    },
  );

  // Anonymous responses for the patched methods. We cast through `unknown`
  // because Supabase's discriminated UserResponse / SessionResponse types
  // have a non-null `user`/`session` in the success branch.
  const ANON_USER = { data: { user: null }, error: null } as unknown as Awaited<
    ReturnType<typeof client.auth.getUser>
  >;
  const ANON_SESSION = { data: { session: null }, error: null } as unknown as Awaited<
    ReturnType<typeof client.auth.getSession>
  >;

  // ── Patch auth.getUser to be crash-proof ─────────────────────────────────
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
    try {
      const res = await originalGetUser(...args);
      if (res.error && isAuthRefreshError(res.error)) {
        tryClearAuthCookies();
        return ANON_USER;
      }
      return res;
    } catch (err) {
      if (isAuthRefreshError(err)) {
        tryClearAuthCookies();
        return ANON_USER;
      }
      console.error('[supabase.server] getUser unexpected:', err);
      return ANON_USER;
    }
  }) as typeof client.auth.getUser;

  // ── Patch auth.getSession the same way ───────────────────────────────────
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = (async (...args: Parameters<typeof originalGetSession>) => {
    try {
      const res = await originalGetSession(...args);
      if (res.error && isAuthRefreshError(res.error)) {
        tryClearAuthCookies();
        return ANON_SESSION;
      }
      return res;
    } catch (err) {
      if (isAuthRefreshError(err)) {
        tryClearAuthCookies();
        return ANON_SESSION;
      }
      console.error('[supabase.server] getSession unexpected:', err);
      return ANON_SESSION;
    }
  }) as typeof client.auth.getSession;

  return client;
}
