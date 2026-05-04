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

export async function createManagerAction(email: string, displayName: string, phone: string) {
  try {
    await requireAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPhone = (phone ?? '').trim();
    if (!cleanEmail || !cleanName) throw new Error('Email and display name are required');
    const adminClient = createAdminClient();
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-2) + String(Math.floor(10 + Math.random() * 90));
    const { data: created, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'streamer', full_name: cleanName, is_manager: true },
    });
    if (authError || !created.user) throw new Error(authError?.message ?? 'Failed to create auth user');
    const newUserId = created.user.id;
    await adminClient.from('streamers').delete().eq('user_id', newUserId);
    const { error: dbError } = await adminClient.from('managers').insert({
      user_id: newUserId,
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
    revalidatePath('/admin/managers');
    return { success: true as const, managerId: newUserId, tempPassword, message: 'Manager created successfully' };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Failed to create manager' };
  }
}

export async function listManagersAction() {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    const { data: managers, error } = await adminClient
      .from('managers')
      .select('id, user_id, display_name, email, phone, status, distribution_count, temp_password, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const list = managers ?? [];
    const withCounts = await Promise.all(
      list.map(async (m) => {
        const { count } = await adminClient.from('orders').select('id', { count: 'exact', head: true }).eq('assigned_manager_id', m.id).not('status', 'in', '(completed,cancelled)');
        return { ...m, activeOrders: count ?? 0 };
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