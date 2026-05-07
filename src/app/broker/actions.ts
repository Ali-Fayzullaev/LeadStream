'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireManager() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use admin client to bypass RLS and avoid column-not-found issues
  const adminClient = createAdminClient();
  const { data: manager, error } = await adminClient
    .from('managers')
    .select('id, status, display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!manager) throw new Error('Manager profile not found');
  if (manager.status === 'blocked') throw new Error('Your account is blocked');
  return { user, manager };
}

// ===========================================================================
// BROKER CRUD (called by manager)
// ===========================================================================

export async function createBrokerAction(
  email: string,
  displayName: string,
  phone: string,
) {
  try {
    const { manager } = await requireManager();

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPhone = (phone ?? '').trim();

    if (!cleanEmail || !cleanName) throw new Error('Email and display name are required');

    const adminClient = createAdminClient();

    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).toUpperCase().slice(-2) +
      String(Math.floor(10 + Math.random() * 90));

    const { data: created, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'broker', full_name: cleanName, is_broker: true },
    });

    if (authError || !created.user) throw new Error(authError?.message ?? 'Failed to create auth user');

    const newUserId = created.user.id;

    // Remove auto-created streamer row if trigger fires
    await adminClient.from('streamers').delete().eq('user_id', newUserId);

    const { error: dbError } = await adminClient.from('brokers').insert({
      user_id: newUserId,
      manager_id: manager.id,
      email: cleanEmail,
      display_name: cleanName,
      phone: cleanPhone || null,
      status: 'active',
      temp_password: tempPassword,
    });

    if (dbError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      throw dbError;
    }

    revalidatePath('/manager/brokers');
    return { success: true as const, tempPassword, message: 'Broker created successfully' };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to create broker' };
  }
}

export async function listMyBrokersAction() {
  try {
    const { manager } = await requireManager();
    const adminClient = createAdminClient();

    const { data: brokers, error } = await adminClient
      .from('brokers')
      .select('id, user_id, display_name, email, phone, status, telegram_chat_id, temp_password, distribution_count, created_at')
      .eq('manager_id', manager.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = brokers ?? [];
    const withCounts = await Promise.all(
      list.map(async (b) => {
        const { count } = await adminClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_broker_id', b.id)
          .not('status', 'in', '(completed,cancelled)');
        return { ...b, activeOrders: count ?? 0 };
      }),
    );

    return { success: true as const, brokers: withCounts };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to fetch brokers', brokers: [] as Array<Record<string, unknown>> };
  }
}

export async function updateBrokerStatusAction(
  brokerId: string,
  status: 'active' | 'inactive' | 'blocked',
) {
  try {
    const { manager } = await requireManager();
    const adminClient = createAdminClient();

    // Verify broker belongs to this manager
    const { data: broker } = await adminClient
      .from('brokers')
      .select('id')
      .eq('id', brokerId)
      .eq('manager_id', manager.id)
      .maybeSingle();
    if (!broker) throw new Error('Broker not found or not yours');

    const { error } = await adminClient
      .from('brokers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', brokerId);
    if (error) throw error;

    revalidatePath('/manager/brokers');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to update broker status' };
  }
}

export async function deleteBrokerAction(brokerId: string) {
  try {
    const { manager } = await requireManager();
    const adminClient = createAdminClient();

    const { data: broker } = await adminClient
      .from('brokers')
      .select('id, user_id')
      .eq('id', brokerId)
      .eq('manager_id', manager.id)
      .maybeSingle();
    if (!broker) throw new Error('Broker not found or not yours');

    await adminClient
      .from('orders')
      .update({ assigned_broker_id: null, updated_at: new Date().toISOString() })
      .eq('assigned_broker_id', brokerId);

    await adminClient.from('brokers').delete().eq('id', brokerId);
    if (broker.user_id) await adminClient.auth.admin.deleteUser(broker.user_id);

    revalidatePath('/manager/brokers');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to delete broker' };
  }
}

// ===========================================================================
// BROKER SELF actions
// ===========================================================================

export async function getBrokerProfileAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Use admin client to avoid RLS issues
    const adminClient = createAdminClient();
    const { data: broker, error } = await adminClient
      .from('brokers')
      .select('id, display_name, email, phone, status, telegram_chat_id, distribution_count')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!broker) throw new Error('Broker profile not found');

    return { success: true as const, broker };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to fetch profile' };
  }
}

/**
 * Sends a test message to the broker's saved telegram_chat_id.
 * Detects "user never started the bot" (403) and returns a helpful error.
 */
export async function sendTestTelegramToBrokerAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();
    const { data: broker } = await adminClient
      .from('brokers')
      .select('display_name, telegram_chat_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!broker) throw new Error('Профиль брокера не найден');
    if (!broker.telegram_chat_id) {
      return {
        success: false as const,
        error:
          'Сначала сохраните Telegram ID. После этого откройте @lead300426_bot и нажмите Start.',
      };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('Бот не настроен (TELEGRAM_BOT_TOKEN отсутствует)');

    const html = [
      '✅ <b>Тестовое уведомление</b>',
      `Привет, <b>${broker.display_name}</b>!`,
      'Если вы это видите — уведомления настроены правильно.',
      'Теперь вы будете получать назначенные лиды прямо сюда.',
    ].join('\n');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: broker.telegram_chat_id,
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
          success: false as const,
          error:
            'Бот не может вам написать. Откройте @lead300426_bot в Telegram и нажмите Start, затем повторите.',
        };
      }
      return { success: false as const, error: desc };
    }
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Ошибка отправки',
    };
  }
}

export async function updateBrokerTelegramAction(telegramChatId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('brokers')
      .update({ telegram_chat_id: telegramChatId.trim() || null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (error) throw error;

    revalidatePath('/broker/profile');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to update Telegram ID' };
  }
}

/**
 * Broker updates the status of one of their assigned leads.
 * Authorization: order.assigned_broker_id must match the current user's broker.id.
 */
export async function updateBrokerOrderStatusAction(orderId: string, newStatus: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();

    const { data: broker, error: bErr } = await adminClient
      .from('brokers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!broker) throw new Error('Broker profile not found');
    if (broker.status === 'blocked') throw new Error('Your account is blocked');

    // Verify the order is assigned to this broker
    const { data: order, error: oErr } = await adminClient
      .from('orders')
      .select('id, assigned_broker_id')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order) throw new Error('Order not found');
    if (order.assigned_broker_id !== broker.id) {
      throw new Error('Not authorized to update this order');
    }

    const { error: updErr } = await adminClient
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (updErr) throw updErr;

    revalidatePath('/broker');
    revalidatePath('/manager');
    revalidatePath('/manager/orders');
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to update order status',
    };
  }
}

export async function getBrokerOrdersAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();
    const { data: broker } = await adminClient
      .from('brokers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!broker) throw new Error('Broker profile not found');

    const { data: orders, error } = await adminClient
      .from('broker_orders')
      .select('*')
      .eq('assigned_broker_id', broker.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return { success: true as const, orders: orders ?? [] };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to fetch orders', orders: [] as unknown[] };
  }
}
