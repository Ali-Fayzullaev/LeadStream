import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/stats?from=&to=&streamerId=
 * Returns dashboard aggregates: totals + per-day series.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const streamerId = searchParams.get('streamerId');

  let q = supabase.from('orders').select('amount, created_at, streamer_id');
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  if (streamerId) q = q.eq('streamer_id', streamerId);

  const [{ data: orders, error }, { count: streamerCount }] = await Promise.all([
    q,
    supabase.from('streamers').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalOrders = orders?.length ?? 0;
  const totalRevenue =
    orders?.reduce((sum, o) => sum + Number(o.amount ?? 0), 0) ?? 0;

  // Group orders by day (YYYY-MM-DD).
  const buckets = new Map<string, { date: string; orders: number; revenue: number }>();
  for (const o of orders ?? []) {
    const day = o.created_at.slice(0, 10);
    const cur = buckets.get(day) ?? { date: day, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.amount ?? 0);
    buckets.set(day, cur);
  }
  const series = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalOrders,
    totalRevenue,
    streamerCount: streamerCount ?? 0,
    series,
  });
}
