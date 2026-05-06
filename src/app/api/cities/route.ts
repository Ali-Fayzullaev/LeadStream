import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('cities')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
