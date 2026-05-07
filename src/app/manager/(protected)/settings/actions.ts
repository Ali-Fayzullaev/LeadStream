'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

export async function updateManagerTelegramAction(telegramChatId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();
    const cleanId = telegramChatId.trim() || null;

    const { error } = await adminClient
      .from('managers')
      .update({ telegram_chat_id: cleanId, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (error) throw error;

    revalidatePath('/manager/settings');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Ошибка сохранения' };
  }
}

/**
 * Send a test Telegram message to the manager's saved chat_id.
 * If the bot has never been started by this user, Telegram returns 403 — we
 * surface that to the UI so the user knows what to do.
 */
export async function sendTestTelegramToManagerAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();
    const { data: manager } = await adminClient
      .from('managers')
      .select('display_name, telegram_chat_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!manager) throw new Error('Профиль менеджера не найден');
    if (!manager.telegram_chat_id) {
      return {
        success: false as const,
        error:
          'Сначала сохраните Telegram ID. После этого откройте @lead300426_bot и нажмите Start.',
      };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('Бот не настроен (TELEGRAM_BOT_TOKEN отсутствует)');

    const html = [
      '✅ <b>Тестовое уведомление</b>',
      `Привет, <b>${manager.display_name}</b>!`,
      'Если вы это видите — уведомления настроены правильно.',
      'Теперь вы будете получать новые лиды прямо сюда.',
    ].join('\n');

    // Direct call so we can detect 403 (user never pressed /start)
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: manager.telegram_chat_id,
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
          success: false as const,
          error:
            'Бот не может вам написать. Откройте @lead300426_bot в Telegram и нажмите Start, затем повторите.',
        };
      }
      return { success: false as const, error: desc };
    }
    // Fire to admin channel too as a confirmation
    void sendTelegramMessage(
      `ℹ️ Менеджер <b>${manager.display_name}</b> подключил Telegram-уведомления.`,
    );

    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Ошибка отправки',
    };
  }
}
