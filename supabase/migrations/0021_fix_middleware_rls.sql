-- ===========================================================================
-- 0021_fix_middleware_rls.sql
-- Allow authenticated users to read their own manager/broker rows
-- This is needed for middleware role detection
-- ===========================================================================

-- Managers: allow user to read their own row
DROP POLICY IF EXISTS "managers_self_select" ON public.managers;
CREATE POLICY "managers_self_select"
  ON public.managers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Brokers: allow user to read their own row
DROP POLICY IF EXISTS "brokers_self_select" ON public.brokers;
CREATE POLICY "brokers_self_select"
  ON public.brokers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Make sure RLS is enabled
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
