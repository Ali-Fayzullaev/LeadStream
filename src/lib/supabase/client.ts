import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Same idea as `lib/supabase/server.ts` but for the browser:
 * if the refresh-token is dead → wipe local storage + cookies for sb-* and
 * silently reload the page so middleware can redirect us to /login instead
 * of the user seeing a hard error.
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

export function createClient(): SupabaseClient {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Defaults are already these in supabase-js@2, but we set them
        // explicitly to make the long-lived behaviour intentional and
        // immune to future default changes:
        persistSession: true,         // store session in localStorage
        autoRefreshToken: true,       // proactively refresh ~10min before expiry
        detectSessionInUrl: true,     // pick up `#access_token=` after OAuth/magic-link
      },
      cookieOptions: {
        // Match server cookie lifetime (1 year). Without this the browser
        // hands out a session-only cookie which dies on tab close →
        // "Invalid Refresh Token" on next visit.
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        path: '/',
      },
    },
  );

  // Listen for global auth errors. supabase-js fires onAuthStateChange with
  // event === 'TOKEN_REFRESHED' or 'SIGNED_OUT'. When it can't refresh, the
  // next .auth.getUser()/getSession() call will throw — we patch those below.
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') __reloadingForAuth = false;
  });

  // Patch getUser
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

  // Patch getSession
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

  return client;
}
