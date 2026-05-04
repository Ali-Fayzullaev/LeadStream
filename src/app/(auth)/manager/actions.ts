import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface CreateManagerInput {
  email: string;
  display_name: string;
  phone?: string;
}

/**
 * Admin action to create a new manager.
 * Creates auth user and manager profile.
 */
export async function adminCreateManagerAction(input: CreateManagerInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const admin = createAdminClient();

  try {
    // 1. Create auth user with temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true, // Skip email confirmation
    });

    if (authError || !authData.user) {
      return { ok: false, error: `Ошибка создания пользователя: ${authError?.message}` };
    }

    // 2. Create manager profile
    const { data: manager, error: managerError } = await admin
      .from('managers')
      .insert({
        user_id: authData.user.id,
        display_name: input.display_name,
        phone: input.phone,
        status: 'active',
      })
      .select('id')
      .single();

    if (managerError) {
      // Cleanup: delete auth user if manager creation fails
      await admin.auth.admin.deleteUser(authData.user.id);
      return { ok: false, error: `Ошибка создания профиля менеджера: ${managerError.message}` };
    }

    return { ok: true, id: manager.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Admin action to delete a manager.
 */
export async function adminDeleteManagerAction(managerId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  try {
    const { data: manager } = await admin
      .from('managers')
      .select('user_id')
      .eq('id', managerId)
      .single();

    if (!manager) {
      return { ok: false, error: 'Менеджер не найден' };
    }

    // 1. Delete manager profile
    await admin.from('managers').delete().eq('id', managerId);

    // 2. Unassign orders
    await admin.from('orders').update({ assigned_manager_id: null }).eq('assigned_manager_id', managerId);

    // 3. Delete auth user
    await admin.auth.admin.deleteUser(manager.user_id);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Manager action to update order status.
 */
export async function managerUpdateOrderStatusAction(
  orderId: string,
  newStatus: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  try {
    // Verify status exists
    const { data: validStatus } = await admin
      .from('order_statuses')
      .select('key')
      .eq('key', newStatus)
      .single();

    if (!validStatus) {
      return { ok: false, error: 'Недопустимый статус' };
    }

    // Update order
    const { error } = await admin
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
