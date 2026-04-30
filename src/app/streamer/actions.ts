'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  updateStreamerProfileSchema,
  tiktokUsernameSchema,
  type UpdateStreamerProfileInput,
} from '@/lib/validations';

export type ActionResult = { ok: true } | { ok: false; error: string };

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
