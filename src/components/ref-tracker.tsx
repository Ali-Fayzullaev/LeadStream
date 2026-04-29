'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';

const REF_KEY = 'leadstream_ref';
const COOKIE_DAYS = 30;

/**
 * Captures `?ref=<code>` once on first visit and persists it for 30 days
 * in BOTH localStorage and a cookie. Subsequent visits keep the same ref.
 */
export function RefTracker() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get('ref');
    if (!ref) return;

    const clean = ref.trim().slice(0, 64);
    if (!clean) return;

    try {
      localStorage.setItem(REF_KEY, clean);
    } catch {
      // Storage unavailable (private mode, etc.) — fall back to cookie only.
    }
    Cookies.set(REF_KEY, clean, { expires: COOKIE_DAYS, sameSite: 'lax' });
  }, [params]);

  return null;
}

/** Read the persisted ref code (client-side). */
export function getStoredRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REF_KEY) ?? Cookies.get(REF_KEY) ?? null;
  } catch {
    return Cookies.get(REF_KEY) ?? null;
  }
}
