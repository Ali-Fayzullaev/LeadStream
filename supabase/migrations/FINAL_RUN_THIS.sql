-- ============================================================================
-- FINAL_RUN_THIS.sql — Запустите этот файл целиком в Supabase SQL Editor
-- Это исправит ВСЕ известные проблемы:
--   • Создание менеджеров
--   • Создание городов
--   • /manager/settings редирект
--   • Сохранение заявок с городом
--   • RLS политики
-- Безопасен для многократного запуска.
-- ============================================================================

-- ── Helper: is_admin() ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── set_updated_at trigger function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. CITIES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_public_read" ON public.cities;
CREATE POLICY "cities_public_read" ON public.cities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "cities_admin_all" ON public.cities;
CREATE POLICY "cities_admin_all" ON public.cities
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed default cities
INSERT INTO public.cities (name, slug, is_active) VALUES
  ('Астана', 'astana', true),
  ('Алматы', 'almaty', true),
  ('Шымкент', 'shymkent', true),
  ('Караганда', 'karaganda', true),
  ('Атырау', 'atyrau', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. MANAGERS table — ensure all columns exist
-- ============================================================================
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS temp_password TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS distribution_count INT DEFAULT 0;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- 3. BROKERS table — create if not exists, ensure all columns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  distribution_count INT DEFAULT 0,
  temp_password TEXT,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS distribution_count INT DEFAULT 0;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS temp_password TEXT;
ALTER TABLE public.brokers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. ORDERS table — ensure routing columns exist
-- ============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone_masked TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_city_id ON public.orders(city_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_manager ON public.orders(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_broker ON public.orders(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_managers_city_id ON public.managers(city_id);
CREATE INDEX IF NOT EXISTS idx_managers_user_id ON public.managers(user_id);
CREATE INDEX IF NOT EXISTS idx_brokers_manager_id ON public.brokers(manager_id);
CREATE INDEX IF NOT EXISTS idx_brokers_user_id ON public.brokers(user_id);

-- ============================================================================
-- 6. RLS POLICIES — managers
-- ============================================================================
DROP POLICY IF EXISTS "managers_read_own" ON public.managers;
DROP POLICY IF EXISTS "managers_update_own" ON public.managers;
DROP POLICY IF EXISTS "managers_admin_all" ON public.managers;
DROP POLICY IF EXISTS "managers self read" ON public.managers;
DROP POLICY IF EXISTS "managers self update" ON public.managers;
DROP POLICY IF EXISTS "managers admin all" ON public.managers;
DROP POLICY IF EXISTS "managers_self_select" ON public.managers;
DROP POLICY IF EXISTS "managers_self_update" ON public.managers;
DROP POLICY IF EXISTS "managers_admin_insert" ON public.managers;
DROP POLICY IF EXISTS "managers_admin_delete" ON public.managers;

CREATE POLICY "managers_self_select" ON public.managers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "managers_self_update" ON public.managers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "managers_admin_insert" ON public.managers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "managers_admin_delete" ON public.managers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 7. RLS POLICIES — brokers
-- ============================================================================
DROP POLICY IF EXISTS "brokers_self_select" ON public.brokers;
DROP POLICY IF EXISTS "brokers_self_update" ON public.brokers;
DROP POLICY IF EXISTS "brokers_admin_all" ON public.brokers;
DROP POLICY IF EXISTS "brokers_manager_view" ON public.brokers;

CREATE POLICY "brokers_self_select" ON public.brokers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "brokers_self_update" ON public.brokers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brokers_admin_all" ON public.brokers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 8. updated_at triggers
-- ============================================================================
DROP TRIGGER IF EXISTS set_managers_updated_at ON public.managers;
CREATE TRIGGER set_managers_updated_at BEFORE UPDATE ON public.managers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_brokers_updated_at ON public.brokers;
CREATE TRIGGER set_brokers_updated_at BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 9. Recreate manager_orders view
-- ============================================================================
DROP VIEW IF EXISTS public.manager_orders CASCADE;
CREATE VIEW public.manager_orders AS
SELECT
  o.id,
  o.created_at,
  o.updated_at,
  o.streamer_id,
  o.assigned_manager_id,
  o.assigned_broker_id,
  o.city_id,
  o.customer_name,
  o.customer_phone,
  CASE
    WHEN length(o.customer_phone) >= 6
      THEN substr(o.customer_phone, 1, greatest(length(o.customer_phone) - 6, 2))
           || repeat('*', 4)
           || substr(o.customer_phone, length(o.customer_phone) - 1)
    ELSE repeat('*', length(o.customer_phone))
  END AS customer_phone_masked,
  o.product_name,
  o.quantity,
  o.amount,
  o.status,
  o.ref_code_snapshot,
  s.display_name AS streamer_name,
  m.display_name AS manager_name,
  c.name AS city_name
FROM public.orders o
LEFT JOIN public.streamers s ON s.id = o.streamer_id
LEFT JOIN public.managers  m ON m.id = o.assigned_manager_id
LEFT JOIN public.cities    c ON c.id = o.city_id;

ALTER VIEW public.manager_orders SET (security_invoker = on);

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'Migration applied successfully! ✅' AS status;
