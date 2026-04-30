'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Cloudflare Turnstile widget — invisible bot check.
 *
 * Setup:
 *  1. https://dash.cloudflare.com/?to=/:account/turnstile → "Add site"
 *     - Domain: lead-stream-vert.vercel.app + localhost (for dev)
 *     - Widget mode: "Managed" (recommended)
 *  2. Copy `Site key` → NEXT_PUBLIC_TURNSTILE_SITE_KEY (.env.local)
 *  3. Copy `Secret key` → TURNSTILE_SECRET_KEY (.env.local, server-only)
 *
 * If the env var is missing, the widget no-ops and the form stays usable
 * (useful for local development without an account).
 */

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      'timeout-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileProps {
  onToken: (token: string | null) => void;
  theme?: 'light' | 'dark' | 'auto';
}

let scriptLoaded = false;
function loadScript(): Promise<void> {
  if (scriptLoaded || typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) {
    scriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    document.head.appendChild(s);
  });
}

export function Turnstile({ onToken, theme = 'auto' }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      // Dev fallback: no-op, but unblock form by passing a sentinel token.
      onToken('dev-no-turnstile');
      return;
    }
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onToken(token),
        'error-callback': () => onToken(null),
        'expired-callback': () => onToken(null),
        'timeout-callback': () => onToken(null),
      });
    });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, theme]);

  if (!siteKey) return null;
  return <div ref={ref} id={`ts-${id}`} className="cf-turnstile" />;
}
