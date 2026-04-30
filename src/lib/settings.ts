import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface AppSettings {
  site_name: string;
  logo_url: string | null;
  admin_telegram_chat_id: string | null;
}

const DEFAULTS: AppSettings = {
  site_name: 'LeadStream',
  logo_url: null,
  admin_telegram_chat_id: null,
};

export const getAppSettings = cache(async (): Promise<AppSettings> => {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('app_settings')
      .select('site_name, logo_url, admin_telegram_chat_id')
      .eq('id', 'global')
      .maybeSingle();
    if (!data) return DEFAULTS;
    return {
      site_name: data.site_name?.trim() || DEFAULTS.site_name,
      logo_url: data.logo_url || null,
      admin_telegram_chat_id: (data as { admin_telegram_chat_id?: string | null }).admin_telegram_chat_id || null,
    };
  } catch {
    return DEFAULTS;
  }
});
