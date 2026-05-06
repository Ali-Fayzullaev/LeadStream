-- ===========================================================================
-- 0022_ensure_all_columns.sql
-- Ensure ALL required columns exist across all tables.
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Run this in Supabase SQL Editor if you get "column does not exist" errors.
-- ===========================================================================

-- ── managers ────────────────────────────────────────────────────────────────
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS temp_password TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS distribution_count INT DEFAULT 0;

-- ── brokers ─────────────────────────────────────────────────────────────────
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL;

-- ── orders ──────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_broker_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone_masked TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_city_id ON public.orders(city_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_manager ON public.orders(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_broker ON public.orders(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_managers_city_id ON public.managers(city_id);
CREATE INDEX IF NOT EXISTS idx_managers_user_id ON public.managers(user_id);
CREATE INDEX IF NOT EXISTS idx_brokers_manager_id ON public.brokers(manager_id);

-- ── cities seed ──────────────────────────────────────────────────────────────
INSERT INTO public.cities (name, slug, is_active)
VALUES 
  ('Астана', 'astana', true),
  ('Алматы', 'almaty', true),
  ('Шымкент', 'shymkent', true)
ON CONFLICT (slug) DO NOTHING;

-- ── Fix managers RLS: allow self-select ──────────────────────────────────────
DROP POLICY IF EXISTS "managers_self_select" ON public.managers;
CREATE POLICY "managers_self_select"
  ON public.managers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "managers_self_update" ON public.managers;
CREATE POLICY "managers_self_update"
  ON public.managers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "managers_admin_insert" ON public.managers;
CREATE POLICY "managers_admin_insert"
  ON public.managers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "managers_admin_delete" ON public.managers;
CREATE POLICY "managers_admin_delete"
  ON public.managers FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Fix brokers RLS: allow self-select ───────────────────────────────────────
DROP POLICY IF EXISTS "brokers_self_select" ON public.brokers;
CREATE POLICY "brokers_self_select"
  ON public.brokers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
