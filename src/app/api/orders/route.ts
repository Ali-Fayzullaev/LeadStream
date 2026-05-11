import { NextResponse, type NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import {
  sendTelegramMessage,
  buildOrderNotificationHtml,
  buildStreamerUnassignedOrderHtml,
  buildManagerLeadNotificationHtml,
  buildBrokerLeadNotificationHtml,
} from '@/lib/telegram';
import { REF_COOKIE } from '@/lib/ref';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Basic phone validation: 10-15 digits
function isValidPhone(phone: string): boolean {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export async function POST(request: NextRequest) {
  const hdrs = headers();
  const ip = getClientIp(hdrs);
  const ua = hdrs.get('user-agent') ?? null;

  // Rate-limit: 5 orders per minute per IP
  const rl = rateLimit(`orders:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много запросов, подождите минуту.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Extract fields
  const customerPhone = ((body.customerPhone as string) ?? '').trim();
  const customerName = ((body.customerName as string | null) ?? '').trim() || null;
  const productName = ((body.productName as string) ?? 'Заявка').trim();
  const quantity = Number(body.quantity) || 1;
  const amount = Number(body.amount) || 0;
  const cityId = (body.cityId as string | null) ?? null;
  const noAttribution = body._no_attribution === true;

  // Phone is required
  if (!customerPhone || !isValidPhone(customerPhone)) {
    return NextResponse.json({ error: 'Введите корректный номер телефона' }, { status: 400 });
  }

  // Resolve ref
  const cookieRef = cookies().get(REF_COOKIE)?.value ?? null;
  const rawRef = (body.ref as string | undefined) ?? '';
  const ref = noAttribution ? null : (rawRef.trim().toLowerCase() || cookieRef?.trim().toLowerCase() || null);

  const admin = createAdminClient();

  // Resolve streamer
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

  // Create order
  const { data: order, error } = await admin
    .from('orders')
    .insert({
      customer_name: customerName,
      customer_phone: customerPhone,
      product_name: productName,
      quantity,
      amount,
      streamer_id: streamerId,
      ref_code_snapshot: refSnapshot,
      city_id: cityId,
      ip,
      user_agent: ua,
      status: 'new',
    })
    .select('id')
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create order' }, { status: 500 });
  }

  // ── City-based routing: assign to manager → then distribute to broker ──────
  let assignedManagerId: string | null = null;
  let assignedManagerTgId: string | null = null;
  let assignedManagerName: string | null = null;
  let assignedBrokerId: string | null = null;
  let assignedBrokerTgId: string | null = null;
  let assignedBrokerName: string | null = null;
  let cityName: string | null = null;

  if (cityId) {
    // Get city name
    const { data: city } = await admin.from('cities').select('name').eq('id', cityId).maybeSingle();
    cityName = city?.name ?? null;

    // Find active manager for this city with least distribution_count
    const { data: managers } = await admin
      .from('managers')
      .select('id, display_name, telegram_chat_id, distribution_count')
      .eq('city_id', cityId)
      .eq('status', 'active')
      .order('distribution_count', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    const manager = managers?.[0] ?? null;

    if (manager) {
      assignedManagerId = manager.id;
      assignedManagerTgId = manager.telegram_chat_id ?? null;
      assignedManagerName = manager.display_name;

      // Find active broker for this manager with least distribution_count
      const { data: brokers } = await admin
        .from('brokers')
        .select('id, display_name, telegram_chat_id, distribution_count')
        .eq('manager_id', manager.id)
        .eq('status', 'active')
        .order('distribution_count', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1);

      const broker = brokers?.[0] ?? null;
      if (broker) {
        assignedBrokerId = broker.id;
        assignedBrokerTgId = broker.telegram_chat_id ?? null;
        assignedBrokerName = broker.display_name;
      }

      // Update order with assignments
      await admin.from('orders').update({
        assigned_manager_id: assignedManagerId,
        assigned_broker_id: assignedBrokerId,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);

      // Increment distribution counts
      await admin.from('managers').update({
        distribution_count: (manager.distribution_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', manager.id);

      if (broker) {
        await admin.from('brokers').update({
          distribution_count: (broker.distribution_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', broker.id);
      }
    }
  } else {
    // No city selected — order stays unassigned, mark for admin review
    // (already saved with city_id = null, assigned_manager_id = null)
  }

  // ── Telegram notifications ─────────────────────────────────────────────────
  const notifPayload = {
    id: order.id,
    customerName: customerName ?? 'Не указано',
    customerPhone,
    productName,
    quantity,
    amount,
    streamerName,
    refCode: refSnapshot,
    cityName,
    managerName: assignedManagerName,
    brokerName: assignedBrokerName,
  };

  // Admin channel — now includes city / manager / broker for full context
  void sendTelegramMessage(buildOrderNotificationHtml(notifPayload));

  // Streamer personal — ONLY when the order has no city yet.
  //
  // Business rule: streamers shouldn't be spammed for orders that already
  // have a city (those flow straight to manager/broker without any action
  // from the streamer). Streamers are pinged only for "unassigned" leads
  // so they open the cabinet, pick the city for the customer, and trigger
  // the normal routing. See `streamer/actions.ts → assignCityToOrderAction`.
  if (streamerChat && !cityId) {
    void sendTelegramMessage(
      buildStreamerUnassignedOrderHtml({
        id: order.id,
        customerName: customerName ?? 'Не указано',
        customerPhone,
        productName,
        quantity,
        amount,
      }),
      streamerChat,
    );
  }

  // Manager personal
  if (assignedManagerTgId) {
    void sendTelegramMessage(
      buildManagerLeadNotificationHtml({
        orderId: order.id,
        customerName: customerName ?? 'Не указано',
        customerPhone,
        cityName,
        productName,
        brokerName: assignedBrokerName,
      }),
      assignedManagerTgId,
    );
  }

  // Broker personal
  if (assignedBrokerTgId) {
    void sendTelegramMessage(
      buildBrokerLeadNotificationHtml({
        orderId: order.id,
        customerName: customerName ?? 'Не указано',
        customerPhone,
        cityName,
        productName,
      }),
      assignedBrokerTgId,
    );
  }

  return NextResponse.json({ id: order.id, ok: true });
}
