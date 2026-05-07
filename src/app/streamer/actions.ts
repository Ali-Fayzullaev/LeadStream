'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  updateStreamerProfileSchema,
  tiktokUsernameSchema,
  type UpdateStreamerProfileInput,
} from '@/lib/validations';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Sends a test Telegram message to the streamer's saved telegram_chat_id.
 * Detects "user never started the bot" and returns a helpful message.
 */
export async function sendTestTelegramToStreamerAction(): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const admin = createAdminClient();
  const { data: streamer } = await admin
    .from('streamers')
    .select('display_name, telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!streamer) return { ok: false, error: 'Профиль стримера не найден' };
  if (!streamer.telegram_chat_id) {
    return {
      ok: false,
      error:
        'Сначала сохраните Telegram ID. После этого откройте @lead300426_bot и нажмите Start.',
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'Бот не настроен' };

  const html = [
    '✅ <b>Тестовое уведомление</b>',
    `Привет, <b>${streamer.display_name}</b>!`,
    'Если вы это видите — уведомления настроены правильно.',
    'Теперь вы будете получать новые заявки прямо сюда.',
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: streamer.telegram_chat_id,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      const desc = data.description ?? 'Telegram отклонил сообщение';
      if (/blocked|deactivated|chat not found|can't initiate/i.test(desc)) {
        return {
          ok: false,
          error:
            'Бот не может вам написать. Откройте @lead300426_bot в Telegram и нажмите Start, затем повторите.',
        };
      }
      return { ok: false, error: desc };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

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
