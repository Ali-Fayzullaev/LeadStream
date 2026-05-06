'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile || profile.role !== 'admin') throw new Error('Only admins can perform this action');
  return { user };
}

export async function updateOrderStatusAction(orderId: string, newStatus: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data: manager, error: mErr } = await supabase.from('managers').select('id, status').eq('user_id', user.id).maybeSingle();
    if (mErr) throw mErr;
    if (!manager) throw new Error('Manager profile not found');
    if (manager.status === 'blocked') throw new Error('Your account is blocked');
    const { data: order, error: oErr } = await supabase.from('orders').select('id, assigned_manager_id').eq('id', orderId).maybeSingle();
    if (oErr) throw oErr;
    if (!order || order.assigned_manager_id !== manager.id) throw new Error('Not authorized to update this order');
    const { error } = await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (error) throw error;
    revalidatePath('/manager');
    revalidatePath('/manager/orders');
    revalidatePath('/admin/orders');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to update order status' };
  }
}

export async function getManagerOrdersAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data: manager } = await supabase.from('managers').select('id').eq('user_id', user.id).maybeSingle();
    if (!manager) throw new Error('Manager profile not found');
    const { data: orders, error } = await supabase.from('manager_orders').select('*').eq('assigned_manager_id', manager.id).order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true as const, orders: orders ?? [] };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to fetch orders', orders: [] as unknown[] };
  }
}

export async function createManagerAction(email: string, displayName: string, phone: string, cityId?: string) {
  try {
    await requireAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPhone = (phone ?? '').trim();
    if (!cleanEmail || !cleanName) {
      return { success: false as const, error: 'Email и ФИО обязательны' };
    }

    const adminClient = createAdminClient();

    // Check if a manager with this email already exists
    const { data: existing } = await adminClient
      .from('managers')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (existing) {
      return { success: false as const, error: `Менеджер с email "${cleanEmail}" уже существует` };
    }

    // Generate temp password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).toUpperCase().slice(-2) +
      String(Math.floor(10 + Math.random() * 90));

    // Step 1: Create auth user. user_metadata.role='manager' so handle_new_user
    // doesn't auto-create a streamer profile (which would block manager creation).
    const { data: created, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'manager', full_name: cleanName },
    });
    if (authError || !created?.user) {
      return {
        success: false as const,
        error: `Auth: ${authError?.message ?? 'не удалось создать пользователя'}`,
      };
    }
    const newUserId = created.user.id;

    // Step 2: Best-effort cleanup — remove any auto-created streamer/profile
    await adminClient.from('streamers').delete().eq('user_id', newUserId);

    // Step 3: Insert manager row. Build payload defensively — skip optional
    // columns if they cause errors (e.g. column not yet migrated).
    const baseRow: Record<string, unknown> = {
      user_id: newUserId,
      email: cleanEmail,
      display_name: cleanName,
      status: 'active',
    };
    if (cleanPhone) baseRow.phone = cleanPhone;

    const fullRow = {
      ...baseRow,
      temp_password: tempPassword,
      city_id: cityId || null,
    };

    let { error: dbError } = await adminClient.from('managers').insert(fullRow);

    // If insert fails because of missing optional columns, retry with base row only
    if (dbError && /column .* does not exist/i.test(dbError.message)) {
      console.warn('[createManagerAction] retry with base columns:', dbError.message);
      ({ error: dbError } = await adminClient.from('managers').insert(baseRow));
    }

    if (dbError) {
      // Rollback: delete auth user
      await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
      return {
        success: false as const,
        error: `DB: ${dbError.message}`,
      };
    }

    revalidatePath('/admin/managers');
    return {
      success: true as const,
      managerId: newUserId,
      tempPassword,
      message: 'Менеджер успешно создан',
    };
  } catch (err) {
    console.error('[createManagerAction] exception:', err);
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Не удалось создать менеджера',
    };
  }
}

export async function listManagersAction() {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    const { data: managers, error } = await adminClient
      .from('managers')
      .select('id, user_id, display_name, email, phone, status, distribution_count, temp_password, created_at, updated_at, city_id, cities(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const list = managers ?? [];
    const withCounts = await Promise.all(
      list.map(async (m) => {
        const { count } = await adminClient.from('orders').select('id', { count: 'exact', head: true }).eq('assigned_manager_id', m.id).not('status', 'in', '(completed,cancelled)');
        const cityName = (m.cities as { name?: string } | null)?.name ?? null;
        return { ...m, activeOrders: count ?? 0, city_name: cityName };
      }),
    );
    return { success: true as const, managers: withCounts };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to fetch managers', managers: [] as Array<Record<string, unknown>> };
  }
}

export async function updateManagerStatusAction(managerId: string, status: 'active' | 'inactive' | 'blocked') {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('managers').update({ status, updated_at: new Date().toISOString() }).eq('id', managerId);
    if (error) throw error;
    revalidatePath('/admin/managers');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to update manager status' };
  }
}

export async function assignOrdersToManagerAction(orderIds: string[], managerId: string) {
  try {
    await requireAdmin();
    if (!orderIds.length) throw new Error('No orders selected');
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('orders').update({ assigned_manager_id: managerId, updated_at: new Date().toISOString() }).in('id', orderIds);
    if (error) throw error;
    try {
      await adminClient.rpc('increment_manager_distribution', { p_manager_id: managerId, p_count: orderIds.length });
    } catch { /* non-critical */ }
    revalidatePath('/admin/managers');
    revalidatePath('/admin/orders');
    revalidatePath('/manager');
    return { success: true as const, message: `${orderIds.length} order(s) assigned` };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to assign orders' };
  }
}

export async function autoDistributeUnassignedOrdersAction() {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    const { data: managers, error: mErr } = await adminClient.from('managers').select('id, distribution_count, created_at').eq('status', 'active').order('distribution_count', { ascending: true }).order('created_at', { ascending: true });
    if (mErr) throw mErr;
    if (!managers || managers.length === 0) return { success: false as const, error: 'Нет активных менеджеров' };
    const { data: orders, error: oErr } = await adminClient.from('orders').select('id').is('assigned_manager_id', null).order('created_at', { ascending: true });
    if (oErr) throw oErr;
    if (!orders || orders.length === 0) return { success: true as const, assigned: 0, message: 'Нет нераспределённых заявок' };
    const assignments: Record<string, string[]> = {};
    orders.forEach((o, idx) => {
      const mgr = managers[idx % managers.length];
      if (!assignments[mgr.id]) assignments[mgr.id] = [];
      assignments[mgr.id].push(o.id);
    });
    const nowIso = new Date().toISOString();
    for (const [mgrId, oIds] of Object.entries(assignments)) {
      const { error: updErr } = await adminClient.from('orders').update({ assigned_manager_id: mgrId, updated_at: nowIso }).in('id', oIds);
      if (updErr) throw updErr;
      const mgr = managers.find((m) => m.id === mgrId);
      await adminClient.from('managers').update({ distribution_count: (mgr?.distribution_count ?? 0) + oIds.length, updated_at: nowIso }).eq('id', mgrId);
    }
    revalidatePath('/admin/orders');
    revalidatePath('/admin/managers');
    revalidatePath('/manager');
    return { success: true as const, assigned: orders.length, message: `Распределено ${orders.length} заявок между ${managers.length} менеджерами` };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Не удалось распределить заявки' };
  }
}

/**
 * Manager assigns/changes/clears the broker on one of their own orders.
 * Authorization: order.assigned_manager_id must match the current user's manager.id.
 */
export async function assignBrokerToOrderAction(orderId: string, brokerId: string | null) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();

    const { data: manager, error: mErr } = await adminClient
      .from('managers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!manager) throw new Error('Manager profile not found');
    if (manager.status === 'blocked') throw new Error('Your account is blocked');

    // Verify the order belongs to this manager
    const { data: order, error: oErr } = await adminClient
      .from('orders')
      .select('id, assigned_manager_id')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order) throw new Error('Order not found');
    if (order.assigned_manager_id !== manager.id) {
      throw new Error('Not authorized to update this order');
    }

    // If a broker is selected, verify it belongs to this manager
    if (brokerId) {
      const { data: broker, error: bErr } = await adminClient
        .from('brokers')
        .select('id, manager_id, status')
        .eq('id', brokerId)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!broker) throw new Error('Broker not found');
      if (broker.manager_id !== manager.id) {
        throw new Error('This broker does not belong to you');
      }
      if (broker.status === 'blocked') {
        throw new Error('This broker is blocked');
      }
    }

    const { error: updErr } = await adminClient
      .from('orders')
      .update({
        assigned_broker_id: brokerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    if (updErr) throw updErr;

    revalidatePath('/manager');
    revalidatePath('/manager/orders');
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to assign broker',
    };
  }
}

export async function deleteManagerAction(managerId: string) {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    const { data: m, error: fetchErr } = await adminClient.from('managers').select('id, user_id').eq('id', managerId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!m) throw new Error('Manager not found');
    await adminClient.from('orders').update({ assigned_manager_id: null, updated_at: new Date().toISOString() }).eq('assigned_manager_id', managerId);
    const { error: delErr } = await adminClient.from('managers').delete().eq('id', managerId);
    if (delErr) throw delErr;
    if (m.user_id) await adminClient.auth.admin.deleteUser(m.user_id);
    revalidatePath('/admin/managers');
    revalidatePath('/admin/orders');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to delete manager' };
  }
}