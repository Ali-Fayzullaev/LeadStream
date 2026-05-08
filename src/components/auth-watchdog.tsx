'use client';

import { useEffect, useRef } from 'react';

/**
 * AuthWatchdog
 * ----------------------------------------------------------------------------
 * A passive client-side helper that lives in the root layout.
 *
 * Why it exists
 * -------------
 * Even with the most defensive Supabase setup, there are still edge cases that
 * leave a user with a "ghost" session in the browser:
 *   – the Supabase Auth service was briefly down (returned 502 / 503), so the
 *     refresh request failed and the SDK gave up retrying;
 *   – the device woke up from sleep with stale cookies;
 *   – the user manually invalidated tokens in another tab.
 *
 * In all these cases the browser sends a dead access-token + a dead refresh-
 * token to our SSR pages → Next.js routes return **502** until the user
 * manually deletes cookies. This component prevents that from happening:
 *
 *   1. On window load + every 25 min, ping a tiny endpoint (`/api/_health/auth`)
 *      that just calls `supabase.auth.getUser()` server-side. The response tells
 *      us whether the cookies are still valid.
 *   2. Globally intercept `fetch()` — if anything returns 401/502 from our
 *      own origin, we treat that as "session is dead" too.
 *   3. When detected → wipe sb-* cookies + localStorage + soft-reload.
 *      Middleware then redirects the user to `/login` cleanly.
 *
 * The component renders **nothing** — it is a pure effect.
 */

const HEALTH_URL = '/api/_health/auth';
/** Re-check session every 25 minutes (Supabase access-tokens are 1h). */
const INTERVAL_MS = 25 * 60 * 1000;

let __wiping = false;

function wipeSupabaseCookies(): void {
  if (typeof document === 'undefined') return;
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim();
    if (name && (name.startsWith('sb-') || name.includes('-auth-token'))) {
      document.cookie = `${name}=; path=/; max-age=0`;
      // Also try with the parent domain (for *.comfort-time.kz deployments)
      try {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 2) {
          const parent = '.' + parts.slice(-2).join('.');
          document.cookie = `${name}=; path=/; domain=${parent}; max-age=0`;
        }
      } catch { /* ignore */ }
    }
  }
}

function wipeSupabaseLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.includes('supabase.auth'))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* private mode */ }
}

function wipeAndReload(reason: string): void {
  if (__wiping) return;
  __wiping = true;
  // eslint-disable-next-line no-console
  console.warn('[AuthWatchdog] session looks dead — wiping cookies. Reason:', reason);
  wipeSupabaseCookies();
  wipeSupabaseLocalStorage();
  // Tiny delay so the browser actually persists the cookie deletion
  setTimeout(() => {
    try { window.location.reload(); } catch { /* */ }
  }, 80);
}

async function probe(): Promise<void> {
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
    // 502 / 503 → backend itself is down: don't wipe, just skip this round.
    if (res.status >= 500) return;
    // 401 → session truly invalid → wipe.
    if (res.status === 401) {
      wipeAndReload('health endpoint returned 401');
      return;
    }
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    if (json && json.authenticated === false && json.had_cookie === true) {
      // We sent sb-* cookies but server says no user → tokens are dead.
      wipeAndReload('cookies present but no user');
    }
  } catch {
    // Network glitch — ignore.
  }
}

export function AuthWatchdog(): null {
  const installedRef = useRef(false);

  useEffect(() => {
    if (installedRef.current) return;
    installedRef.current = true;

    // 1. Probe once on load…
    void probe();

    // 2. …then on a fixed interval.
    const id = window.setInterval(() => { void probe(); }, INTERVAL_MS);

    // 3. Re-check when the tab becomes visible again (laptop wake-up).
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void probe();
    };
    document.addEventListener('visibilitychange', onVisible);

    // 4. Light-weight global fetch interceptor — if any same-origin response
    //    comes back as 401, treat as dead session. We deliberately DO NOT
    //    react to 502/503 here because those are usually transient backend
    //    blips, not auth issues.
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await origFetch(input, init);
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url && url.startsWith('/') && res.status === 401) {
          wipeAndReload(`fetch ${url} → 401`);
        }
      } catch { /* ignore */ }
      return res;
    };

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      // We intentionally don't restore window.fetch — restoring it during
      // hot-reload causes worse bugs than leaving the wrapper in place.
    };
  }, []);

  return null;
}
