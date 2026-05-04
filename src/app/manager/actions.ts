'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the current authenticated user *and* assert that they are an admin
 * (according to public.profiles.role).
 * Throws if not authenticated or not admin.
 */
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Only admins can perform this action');
  }

  return { user };
}

// ===========================================================================
// MANAGER (self) actions
// ===========================================================================

/**
 * Update order status by manager.
 * Manager can only update orders that are assigned to them.
 */
export async function updateOrderStatusAction(orderId: string, newStatus: string) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: manager, error: mErr } = await supabase
      .from('managers')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!manager) throw new Error('Manager profile not found');
    if (manager.status === 'blocked') throw new Error('Your account is blocked');

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, assigned_manager_id')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order || order.assigned_manager_id !== manager.id) {
      throw new Error('Not authorized to update this order');
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;

    revalidatePath('/manager');
    revalidatePath('/admin/orders');
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to update order status',
    };
  }
}

/**
 * Get manager's assigned orders.
 */
export async function getManagerOrdersAction() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!manager) throw new Error('Manager profile not found');

    const { data: orders, error } = await supabase
      .from('manager_orders')
      .select('*')
      .eq('assigned_manager_id', manager.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return { success: true as const, orders: orders ?? [] };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to fetch orders',
      orders: [] as unknown[],
    };
  }
}

// ===========================================================================
// ADMIN actions  (use the service-role client)
// ===========================================================================

/**
 * Admin: create a new manager.
 *
 * Key points:
 * - user_metadata.role MUST be a valid public.user_role enum value ('admin' | 'streamer').
 *   Passing 'manager' crashes the handle_new_user DB trigger.
 *   We pass 'streamer', then immediately delete the auto-created streamer row.
 * - email_confirm: true  → Supabase marks the email as confirmed without sending any email.
 *   The admin hands the temp password to the manager directly.
 */
export async function createManagerAction(
  email: string,
  displayName: string,
  phone: string,
) {
  try {
    await requireAdmin();

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPhone = (phone ?? '').trim();

    if (!cleanEmail || !cleanName) {
      throw new Error('Email and display name are required');
    }

    const adminClient = createAdminClient();

    // Generate a 12-char temp password: lowercase + uppercase + digits
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).toUpperCase().slice(-2) +
      String(Math.floor(10 + Math.random() * 90));

    // Create auth user — email_confirm:true skips the confirmation email entirely
    const { data: created, error: authError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        // 'streamer' is the only safe non-admin value for the DB trigger enum cast
        role: 'streamer',
        full_name: cleanName,
        is_manager: true,
      },
    });

    if (authError || !created.user) {
      throw new Error(authError?.message ?? 'Failed to create auth user');
    }

    const newUserId = created.user.id;

    // The handle_new_user trigger auto-creates a streamer row — remove it
    await adminClient.from('streamers').delete().eq('user_id', newUserId);

    // Insert the managers row
    const { error: dbError } = await adminClient.from('managers').insert({
      user_id: newUserId,
      email: cleanEmail,
      display_name: cleanName,
      phone: cleanPhone || null,
      status: 'active',
    });

    if (dbError) {
      // Roll back: delete the auth user so we don't leave orphans
      await adminClient.auth.admin.deleteUser(newUserId);
      throw dbError;
    }

    revalidatePath('/admin/managers');
    return {
      success: true as const,
      managerId: newUserId,
      tempPassword,
      message: 'Manager created successfully',
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to create manager',
    };
  }
}

/**
 * Admin: list all managers with their active order counts.
 */
export async function listManagersAction() {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();

    const { data: managers, error } = await adminClient
      .from('managers')
      .select('id, user_id, display_name, email, phone, status, distribution_count, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const list = managers ?? [];

    // Count active (non-completed, non-cancelled) orders per manager
    const withCounts = await Promise.all(
      list.map(async (m) => {
        const { count } = await adminClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_manager_id', m.id)
          .not('status', 'in', '(completed,cancelled)');
        return { ...m, activeOrders: count ?? 0 };
      }),
    );

    return { success: true as const, managers: withCounts };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to fetch managers',
      managers: [] as Array<Record<string, unknown>>,
    };
  }
}

/**
 * Admin: update a manager's status.
 */
export async function updateManagerStatusAction(
  managerId: string,
  status: 'active' | 'inactive' | 'blocked',
) {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('managers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', managerId);
    if (error) throw error;

    revalidatePath('/admin/managers');
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to update manager status',
    };
  }
}

/**
 * Admin: assign multiple orders to a single manager.
 */
export async function assignOrdersToManagerAction(orderIds: string[], managerId: string) {
  try {
    await requireAdmin();
    if (!orderIds.length) throw new Error('No orders selected');
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('orders')
      .update({
        assigned_manager_id: managerId,
        updated_at: new Date().toISOString(),
      })
      .in('id', orderIds);
    if (error) throw error;

    // Bump distribution counter — best-effort, RPC may not exist yet
    try {
      await adminClient.rpc('increment_manager_distribution', {
        p_manager_id: managerId,
        p_count: orderIds.length,
      });
    } catch {
      // non-critical
    }

    revalidatePath('/admin/managers');
    revalidatePath('/admin/orders');
    revalidatePath('/manager');
    return {
      success: true as const,
      message: `${orderIds.length} order(s) assigned`,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to assign orders',
    };
  }
}

/**
 * Admin: delete a manager (unassign orders → delete managers row → delete auth user).
 */
export async function deleteManagerAction(managerId: string) {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();

    const { data: m, error: fetchErr } = await adminClient
      .from('managers')
      .select('id, user_id')
      .eq('id', managerId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!m) throw new Error('Manager not found');

    // Unassign their orders first
    await adminClient
      .from('orders')
      .update({ assigned_manager_id: null, updated_at: new Date().toISOString() })
      .eq('assigned_manager_id', managerId);

    // Delete managers row
    const { error: delErr } = await adminClient.from('managers').delete().eq('id', managerId);
    if (delErr) throw delErr;

    // Delete auth user
    if (m.user_id) {
      await adminClient.auth.admin.deleteUser(m.user_id);
    }

    revalidatePath('/admin/managers');
    revalidatePath('/admin/orders');
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to delete manager',
    };
  }
}
