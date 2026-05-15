/**
 * Single source of truth for our Telegram bot identity.
 *
 * Why a dedicated module?
 *   - The bot username is referenced from multiple places: profile pages
 *     (streamer / manager / broker), server actions that produce error
 *     messages ("откройте @<bot> и нажмите Start"), and any future deep
 *     links. Duplicating the username makes bot rotation painful (we
 *     learned this the hard way after the previous bot was compromised).
 *   - Keeping it server-and-client safe means using `NEXT_PUBLIC_*` so
 *     it can be referenced from React components too.
 *
 * The TOKEN lives only in `TELEGRAM_BOT_TOKEN` (server-only, NOT public)
 * and is never imported into client bundles.
 */

/** Public bot username (without leading "@"). Safe to expose to clients. */
export const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || 'comforttimeleadstream_bot';

/** Convenience: `@<username>` for display in UI / error messages. */
export const BOT_HANDLE = `@${BOT_USERNAME}`;

/** Build a `t.me` deep link with an optional `?start=<payload>`. */
export function botStartLink(startPayload?: string): string {
  const base = `https://t.me/${BOT_USERNAME}`;
  return startPayload ? `${base}?start=${encodeURIComponent(startPayload)}` : base;
}
