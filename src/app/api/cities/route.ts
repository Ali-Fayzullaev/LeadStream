import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Public list of cities for the order form.
 *
 * Historical schemas use either `is_active boolean` or `status text`. We try
 * both: first the modern `status='active'` filter, and if the column doesn't
 * exist (or returned 0 rows for a freshly migrated DB), fall back to the
 * legacy `is_active=true` filter. After migration 0026 they're kept in sync,
 * so either path returns the full list.
 */
export async function GET() {
  const admin = createAdminClient();

  // Path A: status='active' (current convention)
  try {
    const { data, error } = await admin
      .from('cities')
      .select('id, name, slug')
      .eq('status', 'active')
      .order('name');
    if (!error && data && data.length > 0) {
      return NextResponse.json(data);
    }
  } catch {
    // status column may not exist on very old schemas — fall through
  }

  // Path B: is_active=true (legacy convention)
  try {
    const { data, error } = await admin
      .from('cities')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name');
    if (!error && data) {
      return NextResponse.json(data);
    }
  } catch {
    // both columns missing — return empty to avoid breaking the form
  }

  return NextResponse.json([], { status: 200 });
}
