import { NextResponse, type NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrderSchema } from '@/lib/validations';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import {
  sendTelegramMessage,
  buildOrderNotificationHtml,
  buildStreamerOrderNotificationHtml,
} from '@/lib/telegram';
import { REF_COOKIE } from '@/lib/ref';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const hdrs = headers();
  const ip = getClientIp(hdrs);
  const ua = hdrs.get('user-agent') ?? null;

  // Rate-limit: 5 orders per minute per IP.
  const rl = rateLimit(`orders:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много запросов, подождите минуту.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Bot defence: Cloudflare Turnstile token sent as `_ts`.
  const turnstileToken =
    typeof body === 'object' && body !== null
      ? ((body as { _ts?: unknown })._ts as string | undefined) ?? null
      : null;
  const captchaOk = await verifyTurnstile(turnstileToken, ip);
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'Проверка безопасности не пройдена. Обновите страницу и попробуйте снова.' },
      { status: 403 },
    );
  }

  const noAttribution =
    typeof body === 'object' && body !== null && (body as { _no_attribution?: unknown })._no_attribution === true;

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Resolve ref: body.ref takes priority, otherwise the cookie. Skip entirely if no-attribution.
  const cookieRef = cookies().get(REF_COOKIE)?.value ?? null;
  const ref = noAttribution
    ? null
    : (data.ref ?? cookieRef ?? '').trim().toLowerCase() || null;

  const admin = createAdminClient();

  let streamerId: string | null = null;
  let streamerName: string | null = null;
  let streamerChat: string | null = null;
  let refSnapshot: string | null = null;

  if (ref) {
    const { data: streamer } = await admin
      .from('streamers')
      .select('id, display_name, ref_code, status, telegram_chat_id')
      .ilike('ref_code', ref)
      .maybeSingle();
    if (streamer && streamer.status === 'active') {
      streamerId = streamer.id;
      streamerName = streamer.display_name;
      streamerChat = streamer.telegram_chat_id;
      refSnapshot = streamer.ref_code;
    }
  }

  const { data: order, error } = await admin
    .from('orders')
    .insert({
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      product_name: data.productName,
      quantity: data.quantity,
      amount: data.amount,
      notes: data.notes ?? null,
      streamer_id: streamerId,
      ref_code_snapshot: refSnapshot,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      ip,
      user_agent: ua,
      status: 'new',
    })
    .select('id')
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create order' }, { status: 500 });
  }

  // Best-effort Telegram notifications: admin channel + streamer's personal chat.
  const payload = {
    id: order.id,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    productName: data.productName,
    quantity: data.quantity,
    amount: data.amount,
    streamerName,
    refCode: refSnapshot,
  };
  void sendTelegramMessage(buildOrderNotificationHtml(payload));
  if (streamerChat) void sendTelegramMessage(buildStreamerOrderNotificationHtml(payload), streamerChat);

  return NextResponse.json({ id: order.id, ok: true });
}
