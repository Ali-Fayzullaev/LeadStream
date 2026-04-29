import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStreamerSchema } from '@/lib/validations';
import { slugifyRef } from '@/lib/utils';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { supabase };
}

/** GET /api/streamers — list streamers + their aggregate stats. */
export async function GET() {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { data, error } = await guard.supabase
    .from('streamer_stats')
    .select('*')
    .order('orders_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ streamers: data });
}

/** POST /api/streamers — create a new streamer. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = createStreamerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const refCode = (parsed.data.refCode ?? slugifyRef(parsed.data.name)).toLowerCase();

  const { data, error } = await guard.supabase
    .from('streamers')
    .insert({
      name: parsed.data.name,
      ref_code: refCode,
      is_active: parsed.data.isActive ?? true,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'refCode already in use' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ streamer: data }, { status: 201 });
}
