import 'server-only';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export const REF_COOKIE = 'ls_ref';

export interface ResolvedRef {
  refCode: string;
  streamerId: string;
  streamerName: string;
}

/**
 * Reads the ls_ref cookie and resolves it to an active streamer.
 * Returns null when missing, malformed, or the streamer is not active.
 */
export async function resolveRefFromCookie(): Promise<ResolvedRef | null> {
  const ref = cookies().get(REF_COOKIE)?.value;
  if (!ref) return null;
  if (!/^[a-z0-9_-]{3,32}$/i.test(ref)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('streamers')
    .select('id, ref_code, display_name, status')
    .ilike('ref_code', ref)
    .maybeSingle();

  if (!data || data.status !== 'active') return null;
  return { refCode: data.ref_code, streamerId: data.id, streamerName: data.display_name };
}
