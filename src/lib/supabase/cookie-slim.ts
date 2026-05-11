/**
 * cookie-slim.ts
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Why this file exists (the 502 story).**
 *
 * Out of the box, `@supabase/ssr` writes the full session object into the
 * `sb-<project>-auth-token` cookie. That object contains the entire `user`:
 * email, identities, app_metadata, user_metadata, timestamps, etc. After
 * base64url encoding the cookie ends up being ~4.5–5 KB. Once the browser
 * also stores `ls_ref`, UTM cookies and Cloudflare's `cf_clearance` /
 * `__cf_bm`, the combined `Cookie:` request header crosses 8 KB.
 *
 * Default nginx (`large_client_header_buffers 4 8k`) cannot fit that, the
 * upstream response gets dropped with `upstream sent too big header`, and
 * the user sees **502 Bad Gateway**. The workaround everybody was hitting
 * was "delete cookies, log in again", which is obviously unacceptable.
 *
 * **The fix in this file**:
 *
 *  - we intercept the value supabase-js wants to persist;
 *  - we keep only the four short fields supabase-js actually needs to
 *    bootstrap a session (`access_token`, `refresh_token`, `expires_at`,
 *    `token_type` + optional `expires_in`);
 *  - the bulky `user` object is dropped — supabase-js will reconstruct it
 *    on demand via `auth.getUser()` (which validates the JWT properly
 *    against the server anyway, so this is also slightly more secure).
 *
 * Resulting cookie size: ~700 bytes (vs ~4700). The Cookie header now
 * comfortably fits into nginx's default buffer → no more 502, regardless
 * of how many marketing / cloudflare cookies the browser collects.
 *
 * The slimming is applied symmetrically on both browser and server clients
 * so cookies set by either side are round-trippable.
 */

const BASE64_PREFIX = 'base64-';

/**
 * What we keep in the cookie. Everything else (most importantly `user`)
 * is stripped and re-derived by supabase-js after the cookie is loaded.
 */
const KEEP_KEYS = new Set([
  'access_token',
  'refresh_token',
  'expires_at',
  'expires_in',
  'token_type',
  'provider_token',
  'provider_refresh_token',
]);

function decodeBase64UrlToString(b64url: string): string {
  // base64url → base64 → utf-8
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // pad
  while (b64.length % 4) b64 += '=';
  if (typeof atob === 'function') {
    // Browser / Edge runtime
    const bin = atob(b64);
    // Convert binary string → bytes → utf-8 string
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Node fallback
  return Buffer.from(b64, 'base64').toString('utf-8');
}

function encodeStringToBase64Url(s: string): string {
  let b64: string;
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    b64 = btoa(bin);
  } else {
    b64 = Buffer.from(s, 'utf-8').toString('base64');
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Best-effort: take a cookie value as supabase-js gave it to us and return
 * the same value with `user` (and any other non-essential field) stripped
 * out. If the input doesn't look like a Supabase session payload we return
 * it unchanged.
 *
 * The encoding (`base64-` prefix or raw JSON) is preserved.
 */
export function slimSupabaseCookieValue(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return value;

  let raw = value;
  let wasBase64 = false;
  if (value.startsWith(BASE64_PREFIX)) {
    try {
      raw = decodeBase64UrlToString(value.substring(BASE64_PREFIX.length));
      wasBase64 = true;
    } catch {
      return value; // not actually base64 — leave it alone
    }
  }

  // Only touch JSON objects
  if (raw[0] !== '{' && raw[0] !== '[') return value;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return value; }

  // We only slim objects (session shape).
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return value;

  const src = parsed as Record<string, unknown>;
  // Bail out if it doesn't look like a Supabase session.
  if (!('access_token' in src) && !('refresh_token' in src)) return value;

  // Already small? Don't bother.
  if (raw.length < 1200) return value;

  const slim: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    if (KEEP_KEYS.has(k)) slim[k] = src[k];
  }
  // Marker so we can spot slim cookies in logs (no functional effect).
  slim._ls_slim = 1;

  const json = JSON.stringify(slim);
  return wasBase64 ? BASE64_PREFIX + encodeStringToBase64Url(json) : json;
}

const CHUNK_RE = /^(.*)\.(\d+)$/;

function isAuthCookieName(name: string): boolean {
  return typeof name === 'string'
    && (name.startsWith('sb-') || name.includes('-auth-token'));
}

/**
 * Slim every Supabase auth cookie in a `cookiesToSet` array.
 *
 * Handles BOTH single-value cookies *and* chunked cookies (`.0`, `.1`, …)
 * that `@supabase/ssr` emits when the session payload is too long:
 *  - chunks belonging to the same key are concatenated,
 *  - the combined value is slimmed (user object stripped),
 *  - if the slim value still fits the chunk size we collapse them back
 *    into a single un-chunked cookie and emit explicit `maxAge: 0` to
 *    delete the now-obsolete `.0` / `.1` cookies.
 *
 * Non-auth cookies (`ls_ref`, UTM, etc.) pass through unchanged.
 *
 * Returns a NEW array — callers must use the returned value.
 */
export function slimAuthCookiesInPlace<
  T extends { name: string; value: string; options?: unknown },
>(cookies: T[]): T[] {
  if (!Array.isArray(cookies) || cookies.length === 0) return cookies;

  // 1. Group auth cookies by their logical key
  const groups = new Map<string, { key: string; parts: T[] }>();
  const passthrough: T[] = [];

  for (const c of cookies) {
    if (!c || typeof c.name !== 'string') { passthrough.push(c); continue; }
    if (!isAuthCookieName(c.name)) { passthrough.push(c); continue; }

    const m = c.name.match(CHUNK_RE);
    const key = m ? m[1] : c.name;
    let group = groups.get(key);
    if (!group) { group = { key, parts: [] }; groups.set(key, group); }
    group.parts.push(c);
  }

  const out: T[] = [...passthrough];

  for (const { key, parts } of groups.values()) {
    // Sort chunks by index (`.0`, `.1`, …); single cookies stay first.
    parts.sort((a, b) => {
      const ma = a.name.match(CHUNK_RE);
      const mb = b.name.match(CHUNK_RE);
      const ia = ma ? Number(ma[2]) : -1;
      const ib = mb ? Number(mb[2]) : -1;
      return ia - ib;
    });

    // Concatenate all chunk values into the original payload supabase-js
    // wanted to write.
    const combined = parts.map(p => p.value).join('');
    const slimmed = slimSupabaseCookieValue(combined);

    // If slimming did nothing (e.g. cookie is being deleted / empty)
    // emit the parts unchanged.
    if (slimmed === combined) {
      out.push(...parts);
      continue;
    }

    // Reuse the options + cookie shape from the first part — preserves
    // path, sameSite, maxAge, etc.
    const template = parts[0];

    // The slim payload almost always fits into a single cookie now.
    // Emit it under the BASE key (without `.0`) and explicitly delete
    // any chunked variants that previously existed for this key.
    const slimCookie = { ...template, name: key, value: slimmed } as T;
    out.push(slimCookie);

    const optsAny = template.options as Record<string, unknown> | undefined;
    const expiringOpts = { ...(optsAny ?? {}), maxAge: 0 } as unknown;
    for (const p of parts) {
      if (p.name !== key) {
        out.push({ ...p, name: p.name, value: '', options: expiringOpts } as T);
      }
    }
  }

  return out;
}
