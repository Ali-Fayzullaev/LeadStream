import 'server-only';

/**
 * Install global handlers ONCE so a stray async error from Supabase
 * (e.g. AuthApiError "Invalid Refresh Token", network blip) doesn't crash
 * the Node process under PM2.
 *
 * We only LOG the error — Next will already render an error boundary if
 * the rejection happens inside a request.
 */
declare global {
  // eslint-disable-next-line no-var
  var __ls_process_handlers_installed: boolean | undefined;
}

if (typeof process !== 'undefined' && !globalThis.__ls_process_handlers_installed) {
  globalThis.__ls_process_handlers_installed = true;

  process.on('unhandledRejection', (reason: unknown) => {
    const e = reason as { status?: number; message?: string; name?: string } | undefined;
    const msg = e?.message ?? String(reason);
    // Quiet, single-line log — easy to grep, no full stack to spam logs
    if (
      e?.status === 400 ||
      e?.status === 401 ||
      /refresh.*token|invalid.*token|jwt|session/i.test(msg)
    ) {
      console.warn('[unhandledRejection] auth/refresh issue (ignored):', msg);
      return;
    }
    console.error('[unhandledRejection]', e?.name ?? 'Error', '-', msg);
  });

  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err?.message ?? err);
    // Don't exit — let PM2 / Next keep the process alive.
  });
}

export {};
