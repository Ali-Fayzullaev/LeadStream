import 'server-only';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Service-role Supabase client. Bypasses RLS — use only on the server,
 * for admin-only operations or trusted background jobs.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role env vars are missing');
  }
  return createSbClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
