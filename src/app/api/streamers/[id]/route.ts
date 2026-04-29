import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: { id: string };
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { supabase };
}

/** PATCH /api/streamers/:id — toggle active flag or rename. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string') update.name = body.name.trim();
  if (typeof body.isActive === 'boolean') update.is_active = body.isActive;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await guard.supabase
    .from('streamers')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ streamer: data });
}

/** DELETE /api/streamers/:id — orders keep their data; streamer link becomes null. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { error } = await guard.supabase.from('streamers').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
