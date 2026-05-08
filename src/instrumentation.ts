/**
 * Next.js instrumentation hook (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
 *
 * Runs ONCE per Node.js process, BEFORE any route is rendered.
 * Perfect place to install global error handlers that prevent the process
 * from crashing because of an unhandled Supabase auth error.
 *
 * Why this exists:
 *   On production we saw `pm2 status` reporting `restarts: 26` and
 *   `[AuthApiError: Invalid Refresh Token: Refresh Token Not Found]`
 *   in `pm2 logs --err`. PM2 was killing the Node process every time
 *   supabase-js threw an unhandled rejection during background refresh,
 *   which made nginx return **502 Bad Gateway** to the user.
 *
 *   The previous mitigation was a `import '@/lib/process-handlers'` from
 *   the root layout — but that import only runs when the layout is
 *   evaluated, i.e. AFTER the very first request. If the auth error fires
 *   during boot (e.g. background timer started by supabase-js' GoTrue
 *   client), the process dies before our handler is installed.
 *
 *   Instrumentation runs strictly earlier — Next.js calls `register()`
 *   immediately after the runtime is ready, BEFORE any user code.
 */
export async function register() {
  // Only on Node.js runtime — Edge runtime doesn't have process.on
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Idempotency guard: HMR / multiple calls
  const g = globalThis as unknown as { __ls_instrumented?: boolean };
  if (g.__ls_instrumented) return;
  g.__ls_instrumented = true;

  const isAuthError = (e: unknown): boolean => {
    if (!e || typeof e !== 'object') return false;
    const x = e as { status?: number; code?: string; message?: string; name?: string; __isAuthError?: boolean };
    if (x.__isAuthError === true) return true;
    if (x.name === 'AuthApiError') return true;
    if (x.status === 400 || x.status === 401) return true;
    if (typeof x.code === 'string' && /refresh_token|invalid_token|jwt|session/i.test(x.code)) return true;
    if (typeof x.message === 'string' && /refresh.*token|invalid.*token|jwt|session/i.test(x.message)) return true;
    return false;
  };

  process.on('unhandledRejection', (reason: unknown) => {
    if (isAuthError(reason)) {
      // Quiet — this is a background supabase-js refresh that failed because
      // a user's cookie has a dead refresh token. Middleware already wipes
      // the cookie on the next request. Nothing to do here, just don't die.
      const msg = (reason as { message?: string })?.message ?? String(reason);
      console.warn('[instrumentation] auth refresh failed (ignored):', msg);
      return;
    }
    // Anything else: log full but DO NOT exit. PM2 should keep us alive.
    console.error('[instrumentation] unhandledRejection:', reason);
  });

  process.on('uncaughtException', (err: Error) => {
    if (isAuthError(err)) {
      console.warn('[instrumentation] auth uncaughtException (ignored):', err.message);
      return;
    }
    console.error('[instrumentation] uncaughtException:', err);
    // Critically: do NOT process.exit() — Next.js can recover via its own
    // error boundaries on the next request. Exiting causes nginx → 502.
  });

  console.log('[instrumentation] global error handlers installed');
}
