import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrderSchema } from '@/lib/validations';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sendTelegramMessage, formatNewOrderMessage } from '@/lib/telegram';

export const runtime = 'nodejs';

/**
 * POST /api/orders — public endpoint that records a new order.
 * - Rate limited per IP to mitigate spam.
 * - Resolves the streamer from the `ref` (refCode) field.
 * - Uses the service-role client because RLS doesn't grant SELECT on streamers
 *   beyond what the public policy allows; service role keeps the lookup simple.
 */
export async function POST(req: NextRequest) {
  // 10 orders / minute / IP — generous for real users, tight for bots.
  const ip = getClientIp(req);
  const rl = rateLimit(`orders:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { ref, ...data } = parsed.data;

  const admin = createAdminClient();

  // Resolve streamer by refCode (case-insensitive, only active ones).
  let streamerId: string | null = null;
  let streamerForNotification: { name: string; refCode: string } | null = null;
  if (ref) {
    const { data: s } = await admin
      .from('streamers')
      .select('id, name, ref_code')
      .ilike('ref_code', ref)
      .eq('is_active', true)
      .maybeSingle();
    if (s) {
      streamerId = s.id;
      streamerForNotification = { name: s.name, refCode: s.ref_code };
    }
  }

  const { data: order, error } = await admin
    .from('orders')
    .insert({
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      product_name: data.productName,
      quantity: data.quantity,
      amount: data.amount ?? 0,
      notes: data.notes ?? null,
      streamer_id: streamerId,
    })
    .select('id, customer_name, customer_phone, product_name, quantity, amount')
    .single();

  if (error || !order) {
    console.error('[orders] insert failed', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  // Fire-and-forget Telegram notification (don't block the response).
  void sendTelegramMessage({
    text: formatNewOrderMessage({
      id: order.id,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      productName: order.product_name,
      quantity: order.quantity,
      amount: order.amount as unknown as number,
      streamer: streamerForNotification,
    }),
  });

  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}

/**
 * GET /api/orders — admin-only listing with optional filters.
 * Filters: ?from=ISO&to=ISO&streamerId=uuid&limit=50
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
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000);

  let q = supabase
    .from('orders')
    .select('*, streamer:streamers(id,name,ref_code)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  if (streamerId) q = q.eq('streamer_id', streamerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}
