import 'server-only';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Safely fetch the current Supabase user.
 *
 * Differences vs `supabase.auth.getUser()`:
 *  - NEVER throws (catches AuthApiError "Invalid Refresh Token", network errors, etc.).
 *  - On token error → silently clears auth cookies and returns `null`, so the
 *    next request behaves like a logged-out user (and middleware will redirect
 *    to /login). This prevents PM2 / dev server crashes from rotten tokens.
 */
export async function getSafeUser(): Promise<User | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isAuthRefreshError(error)) {
        clearSupabaseAuthCookies();
      } else {
        console.error('[getSafeUser] auth.getUser error:', error.message);
      }
      return null;
    }
    return data.user ?? null;
  } catch (err) {
    if (isAuthRefreshError(err)) {
      clearSupabaseAuthCookies();
    } else {
      console.error('[getSafeUser] unexpected:', err);
    }
    return null;
  }
}

/**
 * Same idea for `getSession()`.
 */
export async function getSafeSession() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (isAuthRefreshError(error)) clearSupabaseAuthCookies();
      else console.error('[getSafeSession] auth.getSession error:', error.message);
      return null;
    }
    return data.session ?? null;
  } catch (err) {
    if (isAuthRefreshError(err)) clearSupabaseAuthCookies();
    else console.error('[getSafeSession] unexpected:', err);
    return null;
  }
}

function isAuthRefreshError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 400 || e.status === 401) return true;
  if (typeof e.message === 'string') {
    return /refresh.*token|invalid.*token|jwt|session/i.test(e.message);
  }
  return false;
}

/**
 * Try to wipe all sb-* / *-auth-token cookies from the current request.
 * In a Server Component this throws (cookies are read-only) — that's fine,
 * middleware will clean them up on the very next request anyway.
 */
function clearSupabaseAuthCookies(): void {
  try {
    const store = cookies();
    for (const c of store.getAll()) {
      if (c.name.startsWith('sb-') || c.name.includes('-auth-token')) {
        try {
          store.set(c.name, '', { maxAge: 0, path: '/' });
        } catch {
          // Read-only context (Server Component) — ignore.
        }
      }
    }
  } catch {
    // No cookie store available — nothing to do.
  }
}
