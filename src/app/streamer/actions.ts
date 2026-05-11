'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  updateStreamerProfileSchema,
  tiktokUsernameSchema,
  type UpdateStreamerProfileInput,
} from '@/lib/validations';
import {
  sendTelegramMessage,
  buildManagerLeadNotificationHtml,
  buildBrokerLeadNotificationHtml,
} from '@/lib/telegram';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Sends a test Telegram message to the streamer's saved telegram_chat_id.
 * Detects "user never started the bot" and returns a helpful message.
 */
export async function sendTestTelegramToStreamerAction(): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const admin = createAdminClient();
  const { data: streamer } = await admin
    .from('streamers')
    .select('display_name, telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!streamer) return { ok: false, error: 'Профиль стримера не найден' };
  if (!streamer.telegram_chat_id) {
    return {
      ok: false,
      error:
        'Сначала сохраните Telegram ID. После этого откройте @lead300426_bot и нажмите Start.',
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'Бот не настроен' };

  const html = [
    '✅ <b>Тестовое уведомление</b>',
    `Привет, <b>${streamer.display_name}</b>!`,
    'Если вы это видите — уведомления настроены правильно.',
    'Теперь вы будете получать новые заявки прямо сюда.',
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: streamer.telegram_chat_id,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      const desc = data.description ?? 'Telegram отклонил сообщение';
      if (/blocked|deactivated|chat not found|can't initiate/i.test(desc)) {
        return {
          ok: false,
          error:
            'Бот не может вам написать. Откройте @lead300426_bot в Telegram и нажмите Start, затем повторите.',
        };
      }
      return { ok: false, error: desc };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function updateStreamerProfileAction(input: UpdateStreamerProfileInput): Promise<ActionResult> {
  const parsed = updateStreamerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const patch = parsed.data;
  const { error } = await supabase
    .from('streamers')
    .update({
      display_name: patch.display_name,
      phone: patch.phone ?? null,
      avatar_url: patch.avatar_url ?? null,
      telegram_chat_id: patch.telegram_chat_id ?? null,
    })
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/streamer', 'layout');
  return { ok: true };
}

// ===========================================================================
// TikTok accounts (multi)
// ===========================================================================

async function getCurrentStreamerId(): Promise<{ id: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('streamers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  return data ?? null;
}

export async function addTikTokAccountAction(usernameRaw: string): Promise<ActionResult> {
  const parsed = tiktokUsernameSchema.safeParse(usernameRaw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid username' };
  }
  const username = parsed.data;

  const streamer = await getCurrentStreamerId();
  if (!streamer) return { ok: false, error: 'Not authenticated' };

  const supabase = createClient();
  // Cap at 10
  const { count } = await supabase
    .from('streamer_tiktok_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('streamer_id', streamer.id);
  if ((count ?? 0) >= 10) {
    return { ok: false, error: 'Достигнут лимит 10 аккаунтов' };
  }

  const { error } = await supabase
    .from('streamer_tiktok_accounts')
    .insert({ streamer_id: streamer.id, username });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Этот аккаунт уже добавлен' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/streamer/profile');
  return { ok: true };
}

export async function deleteTikTokAccountAction(id: string): Promise<ActionResult> {
  const streamer = await getCurrentStreamerId();
  if (!streamer) return { ok: false, error: 'Not authenticated' };

  const supabase = createClient();
  const { error } = await supabase
    .from('streamer_tiktok_accounts')
    .delete()
    .eq('id', id)
    .eq('streamer_id', streamer.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/streamer/profile');
  return { ok: true };
}

// ===========================================================================
// Assign city to an unassigned order ("определить заявку")
// ===========================================================================

/**
 * Streamer picks a city for one of their unassigned orders.
 *
 * Validates:
 *   - User is an ACTIVE streamer.
 *   - Order belongs to this streamer.
 *   - `city_id` is currently NULL (once set, streamer can't change it).
 *   - `cityId` references a real, active city.
 *
 * Side-effects:
 *   - Sets `orders.city_id`.
 *   - Picks the least-loaded active manager / broker, assigns them, bumps
 *     distribution counters — same routing as `POST /api/orders` does for
 *     orders that arrive with a city already set.
 *   - Sends Telegram pings to the freshly-assigned manager / broker.
 */
export async function assignCityToOrderAction(
  orderId: string,
  cityId: string,
): Promise<ActionResult> {
  if (typeof orderId !== 'string' || !orderId.trim()) {
    return { ok: false, error: 'Не указана заявка' };
  }
  if (typeof cityId !== 'string' || !cityId.trim()) {
    return { ok: false, error: 'Выберите город' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const admin = createAdminClient();

  const { data: streamer } = await admin
    .from('streamers')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!streamer) return { ok: false, error: 'Профиль стримера не найден' };
  if (streamer.status !== 'active') {
    return { ok: false, error: 'Ваш аккаунт неактивен — действие недоступно' };
  }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, streamer_id, city_id, customer_name, customer_phone, product_name')
    .eq('id', orderId)
    .maybeSingle();
  if (orderErr || !order) return { ok: false, error: 'Заявка не найдена' };
  if (order.streamer_id !== streamer.id) {
    return { ok: false, error: 'Это не ваша заявка' };
  }
  if (order.city_id) {
    return { ok: false, error: 'Город для заявки уже указан' };
  }

  const { data: city } = await admin
    .from('cities')
    .select('id, name, is_active')
    .eq('id', cityId)
    .maybeSingle();
  if (!city) return { ok: false, error: 'Город не найден' };
  if (city.is_active === false) return { ok: false, error: 'Город неактивен' };

  let assignedManagerId: string | null = null;
  let assignedManagerTgId: string | null = null;
  let assignedBrokerId: string | null = null;
  let assignedBrokerTgId: string | null = null;
  let assignedBrokerName: string | null = null;
  let prevManagerCount = 0;
  let prevBrokerCount = 0;

  const { data: managers } = await admin
    .from('managers')
    .select('id, telegram_chat_id, distribution_count')
    .eq('city_id', cityId)
    .eq('status', 'active')
    .order('distribution_count', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  const manager = managers?.[0] ?? null;
  if (manager) {
    assignedManagerId = manager.id;
    assignedManagerTgId = manager.telegram_chat_id ?? null;
    prevManagerCount = manager.distribution_count ?? 0;

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
      prevBrokerCount = broker.distribution_count ?? 0;
    }
  }

  const { error: updErr } = await admin
    .from('orders')
    .update({
      city_id: cityId,
      assigned_manager_id: assignedManagerId,
      assigned_broker_id: assignedBrokerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .is('city_id', null);
  if (updErr) return { ok: false, error: updErr.message };

  if (assignedManagerId) {
    void admin.from('managers').update({
      distribution_count: prevManagerCount + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', assignedManagerId);
  }
  if (assignedBrokerId) {
    void admin.from('brokers').update({
      distribution_count: prevBrokerCount + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', assignedBrokerId);
  }

  const customerName = order.customer_name ?? 'Не указано';
  if (assignedManagerTgId) {
    void sendTelegramMessage(
      buildManagerLeadNotificationHtml({
        orderId: order.id,
        customerName,
        customerPhone: order.customer_phone,
        cityName: city.name,
        productName: order.product_name,
        brokerName: assignedBrokerName,
      }),
      assignedManagerTgId,
    );
  }
  if (assignedBrokerTgId) {
    void sendTelegramMessage(
      buildBrokerLeadNotificationHtml({
        orderId: order.id,
        customerName,
        customerPhone: order.customer_phone,
        cityName: city.name,
        productName: order.product_name,
      }),
      assignedBrokerTgId,
    );
  }

  revalidatePath('/streamer/orders');
  return { ok: true };
}


