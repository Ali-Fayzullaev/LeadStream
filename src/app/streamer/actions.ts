'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateStreamerProfileSchema, type UpdateStreamerProfileInput } from '@/lib/validations';

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

  // RLS forbids changing status / commission_percent / ref_code, so we strip them just in case.
  const patch = parsed.data;
  const { error } = await supabase
    .from('streamers')
    .update({
      display_name: patch.display_name,
      tiktok_username: patch.tiktok_username ?? null,
      phone: patch.phone ?? null,
      avatar_url: patch.avatar_url ?? null,
      telegram_chat_id: patch.telegram_chat_id ?? null,
    })
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/streamer', 'layout');
  return { ok: true };
}
