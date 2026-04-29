'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  adminUpdateStreamerSchema,
  adminCreateStreamerSchema,
  type AdminUpdateStreamerInput,
  type AdminCreateStreamerInput,
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
  status: 'new' | 'confirmed' | 'shipped' | 'completed' | 'cancelled',
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
