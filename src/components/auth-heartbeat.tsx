'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Background "session heartbeat".
 *
 * Why:
 *   - Supabase access-token expires after 1 hour by default.
 *   - If the tab stays open longer than that, the next server-side request
 *     hits an expired JWT, the runtime tries to refresh, and on a flaky
 *     network → unhandled promise rejection → the Node server can crash →
 *     nginx returns **502 Bad Gateway**.
 *   - We avoid all of that by **proactively** asking supabase-js to refresh
 *     the session every 15 minutes from the browser. supabase-js does its
 *     own scheduling under the hood, but heartbeat is a belt-and-braces
 *     guarantee that even tabs left open for days stay valid.
 *
 * What it does:
 *   1. Every 15 min calls `auth.getSession()` (cheap; no network if token
 *      is fresh, otherwise triggers refresh).
 *   2. If refresh fails (refresh-token expired/revoked) → wipe local
 *      cookies + storage and reload. Middleware then redirects to /login.
 *   3. Also runs on `visibilitychange` (when user comes back to the tab).
 *
 * No UI. Mount once in the root layout.
 */
export function AuthHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          // The patched client will already wipe + reload on auth errors.
          // Nothing else to do here.
          return;
        }
        const session = data?.session;
        if (!session) return;

        // If the access token expires in <2 minutes, force a refresh now
        // so we never present an expired token to the server.
        const expiresAt = session.expires_at; // seconds since epoch
        if (typeof expiresAt === 'number') {
          const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
          if (secondsLeft < 120) {
            await supabase.auth.refreshSession();
          }
        }
      } catch {
        // Already handled by the patched client (wipe + reload on auth errors).
      }
    };

    // Initial check (covers laptop-wake / long-idle scenarios)
    tick();

    // Every 15 minutes
    const FIFTEEN_MIN = 15 * 60 * 1000;
    const id = window.setInterval(tick, FIFTEEN_MIN);

    // Run once when user returns to the tab
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return null;
}
