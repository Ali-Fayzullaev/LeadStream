'use client';

import { useEffect } from 'react';

/**
 * Defensive: this app does not register any Service Worker.
 * If a stale SW is left over from another dev project on the same origin
 * (localhost:3000), it intercepts /_next/* chunks and breaks webpack.
 * This component unregisters any SW + clears caches on mount.
 */
export function ServiceWorkerKiller() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let reloaded = false;
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        if (regs.length === 0) return;
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys().catch(() => [] as string[]);
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
        }
        // After cleanup, force a single reload so chunks come from network, not the dead SW.
        if (!reloaded) {
          reloaded = true;
          window.location.reload();
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
