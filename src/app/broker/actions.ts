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

  const { data: manager } = await supabase
    .from('managers')
    .select('id, status, display_name, telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

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

    const { data: broker, error } = await supabase
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

export async function updateBrokerTelegramAction(telegramChatId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
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

export async function getBrokerOrdersAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: broker } = await supabase
      .from('brokers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!broker) throw new Error('Broker profile not found');

    const { data: orders, error } = await supabase
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
