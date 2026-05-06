-- ===========================================================================
-- 0020_fix_orders_columns.sql
-- Ensure orders table has all required columns for city routing
-- Safe to run multiple times (IF NOT EXISTS)
-- ===========================================================================

-- Add city_id column if missing
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;

-- Add assigned_manager_id if missing
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL;

-- Add assigned_broker_id if missing
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_broker_id UUID;

-- Add telegram_chat_id to managers if missing
ALTER TABLE public.managers
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Add telegram_chat_id to brokers if missing
ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Index for fast city-based routing
CREATE INDEX IF NOT EXISTS idx_orders_city_id ON public.orders(city_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_manager ON public.orders(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_broker ON public.orders(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_managers_city_id ON public.managers(city_id);
CREATE INDEX IF NOT EXISTS idx_brokers_manager_id ON public.brokers(manager_id);

-- Seed Астана if not exists (with slug)
INSERT INTO public.cities (name, slug, is_active)
VALUES ('Астана', 'astana', true)
ON CONFLICT DO NOTHING;
