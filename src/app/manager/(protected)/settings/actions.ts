'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateManagerTelegramAction(telegramChatId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('managers')
      .update({ telegram_chat_id: telegramChatId || null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (error) throw error;

    revalidatePath('/manager/settings');
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Ошибка сохранения' };
  }
}
