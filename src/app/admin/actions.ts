'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sendTelegramMessage,
  sendTelegramToAdmin,
  buildStreamerStatusChangeHtml,
  buildOrderStatusChangeHtml,
} from '@/lib/telegram';
import {
  adminUpdateStreamerSchema,
  adminCreateStreamerSchema,
  adminUpdateProfileSchema,
  adminUpdateEmailSchema,
  adminChangePasswordSchema,
  orderStatusSchema,
  orderStatusUpdateSchema,
  learnLessonSchema,
  learnLessonUpdateSchema,
  type AdminUpdateStreamerInput,
  type AdminCreateStreamerInput,
  type AdminUpdateProfileInput,
  type AdminUpdateEmailInput,
  type AdminChangePasswordInput,
  type OrderStatusInput,
  type OrderStatusUpdateInput,
  type LearnLessonInput,
  type LearnLessonUpdateInput,
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

  // Snapshot previous state to detect status transitions.
  const { data: prev } = await admin
    .from('streamers')
    .select('display_name, ref_code, status, telegram_chat_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await admin.from('streamers').update(parsed.data).eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Notify the streamer (and admin) on status change.
  if (prev && parsed.data.status && parsed.data.status !== prev.status) {
    const html = buildStreamerStatusChangeHtml({
      fullName: (parsed.data.display_name ?? prev.display_name) as string,
      refCode: (parsed.data.ref_code ?? prev.ref_code) as string,
      oldStatus: prev.status as string,
      newStatus: parsed.data.status,
    });
    if (prev.telegram_chat_id) void sendTelegramMessage(html, prev.telegram_chat_id as string);
    void sendTelegramToAdmin(html);
  }

  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminUpdateOrderStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const admin = createAdminClient();

  // Snapshot order + streamer chat for notifications.
  const { data: prev } = await admin
    .from('orders')
    .select('status, customer_name, product_name, amount, streamer_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await admin.from('orders').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  if (prev && prev.status !== status) {
    // Resolve human-readable labels (Russian) from order_statuses.
    const { data: statuses } = await admin
      .from('order_statuses')
      .select('key, label');
    const labelOf = (key: string) =>
      (statuses ?? []).find((s) => (s as { key: string }).key === key)?.label ?? key;

    let chatId: string | null = null;
    if (prev.streamer_id) {
      const { data: s } = await admin
        .from('streamers')
        .select('telegram_chat_id')
        .eq('id', prev.streamer_id)
        .maybeSingle();
      chatId = (s as { telegram_chat_id?: string | null } | null)?.telegram_chat_id ?? null;
    }

    if (chatId) {
      void sendTelegramMessage(
        buildOrderStatusChangeHtml({
          orderId: id,
          customerName: prev.customer_name as string,
          productName: prev.product_name as string,
          amount: Number(prev.amount),
          oldStatusLabel: labelOf(prev.status as string) as string,
          newStatusLabel: labelOf(status) as string,
        }),
        chatId,
      );
    }
  }

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

export async function adminUpdateEmailAction(input: AdminUpdateEmailInput): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: 'Forbidden' };
  const parsed = adminUpdateEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  if (parsed.data.email.toLowerCase() === user.email?.toLowerCase()) {
    return { ok: false, error: 'Этот email уже используется' };
  }

  // Re-authenticate via current password to confirm identity.
  const supabase = createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.current_password,
  });
  if (signErr) return { ok: false, error: 'Текущий пароль неверный' };

  const admin = createAdminClient();
  // Update auth email immediately (skip Supabase confirmation flow).
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    email: parsed.data.email,
    email_confirm: true,
  });
  if (authErr) return { ok: false, error: authErr.message };

  // Mirror in profiles table for consistent UI.
  const { error: profErr } = await admin
    .from('profiles')
    .update({ email: parsed.data.email })
    .eq('id', user.id);
  if (profErr) return { ok: false, error: profErr.message };

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

// ============================================================================
// App settings (site name + logo)
// ============================================================================

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export async function adminUpdateSiteSettingsAction(formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };

  const siteNameRaw = String(formData.get('site_name') ?? '').trim();
  if (siteNameRaw.length < 2 || siteNameRaw.length > 60) {
    return { ok: false, error: 'Имя сайта: от 2 до 60 символов' };
  }

  const tgRaw = String(formData.get('admin_telegram_chat_id') ?? '').trim();
  if (tgRaw && !/^-?\d{5,32}$/.test(tgRaw)) {
    return { ok: false, error: 'Telegram chat ID: только цифры (для групп — со знаком минус)' };
  }

  const removeLogo = formData.get('remove_logo') === '1';
  const file = formData.get('logo') as File | null;

  const admin = createAdminClient();

  // Load current row to know previous logo path (for cleanup).
  const { data: current } = await admin
    .from('app_settings')
    .select('logo_url')
    .eq('id', 'global')
    .maybeSingle();

  const update: { site_name: string; admin_telegram_chat_id: string | null; logo_url?: string | null } = {
    site_name: siteNameRaw,
    admin_telegram_chat_id: tgRaw || null,
  };

  if (file && file.size > 0) {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return { ok: false, error: 'Логотип: разрешены PNG, JPG, SVG, WEBP' };
    }
    if (file.size > MAX_LOGO_BYTES) {
      return { ok: false, error: 'Логотип: размер до 2 MB' };
    }
    const ext =
      file.type === 'image/svg+xml'
        ? 'svg'
        : file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
            ? 'webp'
            : 'jpg';
    const path = `logo-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('branding')
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = admin.storage.from('branding').getPublicUrl(path);
    update.logo_url = pub.publicUrl;

    // Best-effort cleanup of previous file.
    if (current?.logo_url) {
      const prev = extractStoragePath(current.logo_url);
      if (prev && prev !== path) {
        await admin.storage.from('branding').remove([prev]).catch(() => {});
      }
    }
  } else if (removeLogo) {
    update.logo_url = null;
    if (current?.logo_url) {
      const prev = extractStoragePath(current.logo_url);
      if (prev) await admin.storage.from('branding').remove([prev]).catch(() => {});
    }
  }

  const { error } = await admin
    .from('app_settings')
    .upsert({ id: 'global', ...update }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

function extractStoragePath(publicUrl: string): string | null {
  const idx = publicUrl.indexOf('/branding/');
  if (idx === -1) return null;
  return publicUrl.slice(idx + '/branding/'.length);
}


// ---------------------------------------------------------------------------
// Learn lessons (admin CRUD)
// ---------------------------------------------------------------------------

export async function adminCreateLearnLessonAction(input: LearnLessonInput): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const parsed = learnLessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('learn_lessons')
    .insert(parsed.data)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/learn');
  revalidatePath('/streamer/learn');
  return { ok: true, data: { id: data.id } };
}

export async function adminUpdateLearnLessonAction(
  id: string,
  input: LearnLessonUpdateInput,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const parsed = learnLessonUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };

  const admin = createAdminClient();
  const { error } = await admin.from('learn_lessons').update(parsed.data).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/learn');
  revalidatePath('/streamer/learn');
  return { ok: true };
}

export async function adminDeleteLearnLessonAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'Forbidden' };
  const admin = createAdminClient();
  const { error } = await admin.from('learn_lessons').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/learn');
  revalidatePath('/streamer/learn');
  return { ok: true };
}
