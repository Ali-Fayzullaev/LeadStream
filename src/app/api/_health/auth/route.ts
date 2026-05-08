import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Tiny health-check endpoint used by `<AuthWatchdog />` on the client.
 *
 * Contract:
 *   GET /api/_health/auth
 *     → 200 { authenticated: boolean, had_cookie: boolean }
 *
 * `had_cookie` tells the client whether the request actually arrived with a
 * Supabase auth cookie — combined with `authenticated:false` it proves the
 * session is dead (cookies present, but Supabase doesn't recognise them) and
 * the watchdog can safely wipe them.
 *
 * `createClient()` itself is crash-proof (see `lib/supabase/server.ts`), so
 * even with a malformed refresh-token this never throws / never returns 502.
 */
export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const had_cookie = /(?:^|;\s*)sb-[^=]+=/.test(cookieHeader);

  let authenticated = false;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    authenticated = !!data?.user;
  } catch {
    authenticated = false;
  }

  return NextResponse.json(
    { authenticated, had_cookie },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    },
  );
}
