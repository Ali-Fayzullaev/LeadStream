-- LeadStream — Step 4: Admin Telegram chat id in app_settings
-- Allows admin to receive order notifications without env vars.
-- ---------------------------------------------------------------------------

alter table public.app_settings
  add column if not exists admin_telegram_chat_id text;
