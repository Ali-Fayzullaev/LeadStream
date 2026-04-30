import 'server-only';

const SECRET = process.env.TURNSTILE_SECRET_KEY;

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if the token is valid OR if Turnstile is not configured (dev mode).
 *
 * In production we treat a missing secret as a misconfiguration → return false
 * unless the request comes with the dev sentinel token.
 */
export async function verifyTurnstile(token: string | null, ip?: string | null): Promise<boolean> {
  // Dev / not configured: allow only the sentinel from <Turnstile> client component.
  if (!SECRET) {
    return process.env.NODE_ENV !== 'production' || token === 'dev-no-turnstile';
  }
  if (!token) return false;
  if (token === 'dev-no-turnstile') return false;

  try {
    const body = new URLSearchParams();
    body.set('secret', SECRET);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
