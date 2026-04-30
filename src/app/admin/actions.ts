'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  adminUpdateStreamerSchema,
  adminCreateStreamerSchema,
  adminUpdateProfileSchema,
  adminChangePasswordSchema,
  orderStatusSchema,
  orderStatusUpdateSchema,
  type AdminUpdateStreamerInput,
  type AdminCreateStreamerInput,
  type AdminUpdateProfileInput,
  type AdminChangePasswordInput,
  type OrderStatusInput,
  type OrderStatusUpdateInput,
} from '@/lib/validations';

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  return profile?.role === 'admin' ? user : null;
}

export async function adminUpdateStreamerAction(
  id: string,
  input: AdminUpdateStreamerInput,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const parsed = adminUpdateStreamerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();

  // ref_code uniqueness pre-check
  if (parsed.data.ref_code) {
    const { data: existing } = await admin
      .from('streamers')
      .select('id')
      .ilike('ref_code', parsed.data.ref_code)
      .neq('id', id)
      .maybeSingle();
    if (existing) return { ok: false, error: `Ref-code "${parsed.data.ref_code}" is already taken.` };
  }

  const { error } = await admin.from('streamers').update(parsed.data).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminUpdateOrderStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const admin = createAdminClient();
  const { error } = await admin.from('orders').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminCreateStreamerAction(input: AdminCreateStreamerInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const parsed = adminCreateStreamerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();

  // Ref-code uniqueness check.
  const { data: existing } = await admin
    .from('streamers')
    .select('id')
    .ilike('ref_code', parsed.data.refCode)
    .maybeSingle();
  if (existing) return { ok: false, error: `Ref-code "${parsed.data.refCode}" is already taken.` };

  // Create auth user with auto-confirm + metadata so the trigger creates profile + streamer.
  const { data: created, error: signErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      role: 'streamer',
      full_name: parsed.data.fullName,
      desired_ref_code: parsed.data.refCode,
    },
  });
  if (signErr || !created.user) return { ok: false, error: signErr?.message ?? 'Failed to create user' };

  // Approve immediately and apply commission.
  const { error: updErr } = await admin
    .from('streamers')
    .update({
      status: 'active',
      commission_percent: parsed.data.commissionPercent,
      ref_code: parsed.data.refCode,
    })
    .eq('user_id', created.user.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminDeleteOrderAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const admin = createAdminClient();
  const { error } = await admin.from('orders').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ============================================================================
// Admin profile / password
// ============================================================================

export async function adminUpdateProfileAction(input: AdminUpdateProfileInput): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = adminUpdateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ full_name: parsed.data.full_name })
    .eq('id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminChangePasswordAction(input: AdminChangePasswordInput): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = adminChangePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  // Verify the current password by trying to sign in.
  const supabase = createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.current_password,
  });
  if (signErr) return { ok: false, error: 'Текущий пароль неверный' };

  // Update password.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

// ============================================================================
// Order statuses CRUD
// ============================================================================

export async function adminCreateStatusAction(input: OrderStatusInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();

  // Uniqueness check on key.
  const { data: existing } = await admin
    .from('order_statuses')
    .select('key')
    .eq('key', parsed.data.key)
    .maybeSingle();
  if (existing) return { ok: false, error: `Ключ "${parsed.data.key}" уже существует` };

  const { error } = await admin.from('order_statuses').insert({
    key: parsed.data.key,
    label: parsed.data.label,
    color: parsed.data.color,
    sort_order: parsed.data.sort_order,
    is_system: false,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminUpdateStatusAction(
  key: string,
  input: OrderStatusUpdateInput,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const parsed = orderStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();
  const { error } = await admin.from('order_statuses').update(parsed.data).eq('key', key);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminDeleteStatusAction(
  key: string,
  options?: { replaceWith?: string },
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const admin = createAdminClient();

  const { data: status } = await admin
    .from('order_statuses')
    .select('is_system')
    .eq('key', key)
    .maybeSingle();
  if (!status) return { ok: false, error: 'Статус не найден' };

  // Count orders using this status.
  const { count } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', key);

  // If there are orders, reassign them first.
  if ((count ?? 0) > 0) {
    const replaceWith = options?.replaceWith;
    if (!replaceWith) {
      return {
        ok: false,
        error: `Статус используется в ${count} заказах. Выберите статус для переноса.`,
      };
    }
    if (replaceWith === key) {
      return { ok: false, error: 'Нельзя перенести в этот же статус' };
    }
    // Verify target exists.
    const { data: target } = await admin
      .from('order_statuses')
      .select('key')
      .eq('key', replaceWith)
      .maybeSingle();
    if (!target) return { ok: false, error: 'Целевой статус не найден' };

    const { error: updErr } = await admin
      .from('orders')
      .update({ status: replaceWith })
      .eq('status', key);
    if (updErr) return { ok: false, error: updErr.message };
  }

  // Now safe to delete (works for both system and custom).
  const { error } = await admin.from('order_statuses').delete().eq('key', key);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin', 'layout');
  return { ok: true };
}
