import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { slimAuthCookiesInPlace } from '@/lib/supabase/cookie-slim';

/**
 * Browser Supabase client.
 *
 * Two critical fixes vs the previous implementation (root cause of the
 * "site works for a while, then 502 until I delete cookies" bug):
 *
 *  1) **No-op `auth.lock`.**
 *     `@supabase/gotrue-js` by default uses `navigator.locks.request(...,
 *     { mode: 'exclusive' }, ...)` to serialise refreshes across tabs.
 *     `navigator.locks` is only available on **secure contexts (HTTPS)**.
 *     On the production HTTPS domain the lock can deadlock on Next.js
 *     soft-navigations: the previous page hasn't released the lock yet
 *     before the next page tries to refresh the token. Result: any call
 *     to `auth.getSession()` / `auth.getUser()` hangs forever, the React
 *     server component awaiting it never resolves, the request to Node
 *     never returns, nginx hits its `proxy_read_timeout` and serves a
 *     **502 Bad Gateway** to the user. Clearing cookies "fixes" it
 *     because then the client doesn't try to refresh at all.
 *
 *     The fix is the same one used by the sister project (`tobacco-
 *     supabase`): replace the lock with a no-op. For a single tab this
 *     is identical to the locked version. For multiple tabs the worst
 *     case is two concurrent refreshes — supabase's refresh-token rotation
 *     reuse-interval (default 10s) makes that completely safe.
 *
 *  2) **Singleton.**
 *     Two `GoTrueClient` instances on the same page compete for the same
 *     `localStorage` key (and on HTTPS, the same `BroadcastChannel`),
 *     producing race conditions that occasionally wipe the access token
 *     mid-flight. Cache one client per browser session.
 *
 * Plus the existing safety nets are kept:
 *  - long-lived cookies (1 year) so the session survives tab close,
 *  - patched `getUser`/`getSession` that wipe a dead token + reload
 *    instead of throwing.
 */

function isAuthRefreshError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; code?: string };
  if (e.status === 400 || e.status === 401) return true;
  if (typeof e.code === 'string' && /refresh.*token|invalid.*token|jwt|session/i.test(e.code)) return true;
  if (typeof e.message === 'string' && /refresh.*token|invalid.*token|jwt|session/i.test(e.message)) return true;
  return false;
}

let __reloadingForAuth = false;

function wipeAndReload(): void {
  if (__reloadingForAuth) return;
  __reloadingForAuth = true;
  try {
    // Clear sb-* cookies
    for (const c of document.cookie.split(';')) {
      const name = c.split('=')[0]?.trim();
      if (name && (name.startsWith('sb-') || name.includes('-auth-token'))) {
        document.cookie = `${name}=; path=/; max-age=0`;
      }
    }
    // Clear localStorage entries Supabase uses
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('supabase.auth'))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {/* private mode */}
  } catch {/* ignore */}
  // Soft reload — middleware will redirect to /login
  setTimeout(() => {
    try { window.location.reload(); } catch {/* */}
  }, 50);
}

// ─── Singleton cache ─────────────────────────────────────────────────────────
// One GoTrueClient per browser tab. Multiple instances would compete for the
// same localStorage key and the same BroadcastChannel → corrupted auth state.
let __cachedClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (typeof window !== 'undefined' && __cachedClient) {
    return __cachedClient;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Long-lived browser session — see file header.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // ── CRITICAL: replace the navigator.locks-based lock with a no-op.
        // On HTTPS the default exclusive lock can deadlock during Next.js
        // soft-navigation, hanging getSession() forever and producing 502
        // from nginx. See file header for the full rationale.
        // The signature matches gotrue-js' `LockFunc`.
        // @ts-ignore — `lock` exists in @supabase/gotrue-js but isn't surfaced
        //              in the @supabase/ssr typings.
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
      },
      cookieOptions: {
        // Match server cookie lifetime (1 year). Without this the browser
        // hands out a session-only cookie which dies on tab close →
        // "Invalid Refresh Token" on next visit.
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        path: '/',
      },
      // ── Custom cookies API ──────────────────────────────────────────────
      // We provide our own getAll/setAll so we can SLIM the auth-token
      // cookie before it touches document.cookie. Without this, supabase-js
      // writes the whole session blob (~4.7 KB base64-encoded) into
      // document.cookie → the next request to Next.js carries an oversized
      // Cookie header → nginx replies 502 Bad Gateway.
      //
      // After slimming the persisted cookie is ~700 bytes (only
      // access_token / refresh_token / expires_at / token_type kept).
      // `auth.getUser()` will re-fetch the user object from Supabase when
      // needed, so there's no functional regression.
      //
      // See `cookie-slim.ts` for the full rationale.
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [];
          const out: { name: string; value: string }[] = [];
          for (const part of document.cookie.split(';')) {
            const eq = part.indexOf('=');
            if (eq < 0) continue;
            const name = part.slice(0, eq).trim();
            if (!name) continue;
            const value = decodeURIComponent(part.slice(eq + 1));
            out.push({ name, value });
          }
          return out;
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;
          // Slim every sb-*-auth-token cookie. Keeps document.cookie short
          // and consequently the next request's Cookie header short →
          // nginx is happy → no 502.
          const slimmed = slimAuthCookiesInPlace(cookiesToSet as { name: string; value: string; options?: unknown }[]);
          for (const { name, value, options } of slimmed) {
            // Build a Set-Cookie compatible string for document.cookie.
            // We always set path=/, sameSite=Lax, plus a 1-year maxAge so
            // the cookie survives across browser sessions (same policy as
            // the server-side write in middleware.ts / server.ts).
            const opts = (options ?? {}) as {
              maxAge?: number;
              path?: string;
              domain?: string;
              sameSite?: 'lax' | 'strict' | 'none' | boolean;
              secure?: boolean;
              expires?: Date;
            };
            const parts: string[] = [];
            parts.push(`${name}=${encodeURIComponent(value)}`);
            parts.push(`Path=${opts.path ?? '/'}`);
            const maxAge = typeof opts.maxAge === 'number' ? opts.maxAge : 60 * 60 * 24 * 365;
            // Deletion case: maxAge === 0 → also include Expires in the past.
            if (maxAge === 0) {
              parts.push('Max-Age=0');
              parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            } else {
              parts.push(`Max-Age=${maxAge}`);
            }
            if (opts.domain) parts.push(`Domain=${opts.domain}`);
            const sameSite = opts.sameSite ?? 'lax';
            parts.push(`SameSite=${typeof sameSite === 'string' ? sameSite : 'Lax'}`);
            if (opts.secure ?? (typeof location !== 'undefined' && location.protocol === 'https:')) {
              parts.push('Secure');
            }
            try { document.cookie = parts.join('; '); } catch { /* private mode */ }
          }
        },
      },
    },
  );

  // Reset the reload guard if the user signs out cleanly.
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') __reloadingForAuth = false;
  });

  // ── Patch getUser ────────────────────────────────────────────────────────
  const origGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async (...args: Parameters<typeof origGetUser>) => {
    try {
      const res = await origGetUser(...args);
      if (res.error && isAuthRefreshError(res.error)) {
        wipeAndReload();
        return { data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof origGetUser>>;
      }
      return res;
    } catch (err) {
      if (isAuthRefreshError(err)) {
        wipeAndReload();
        return { data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof origGetUser>>;
      }
      throw err;
    }
  }) as typeof client.auth.getUser;

  // ── Patch getSession ─────────────────────────────────────────────────────
  const origGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = (async (...args: Parameters<typeof origGetSession>) => {
    try {
      const res = await origGetSession(...args);
      if (res.error && isAuthRefreshError(res.error)) {
        wipeAndReload();
        return { data: { session: null }, error: null } as unknown as Awaited<ReturnType<typeof origGetSession>>;
      }
      return res;
    } catch (err) {
      if (isAuthRefreshError(err)) {
        wipeAndReload();
        return { data: { session: null }, error: null } as unknown as Awaited<ReturnType<typeof origGetSession>>;
      }
      throw err;
    }
  }) as typeof client.auth.getSession;

  if (typeof window !== 'undefined') {
    __cachedClient = client;
  }
  return client;
}
