-- LeadStream — Step 9: Apply security_invoker to daily_stats view.
-- Without this, RLS is bypassed on the underlying orders table
-- and any authenticated user could read aggregated data of all streamers.
-- ---------------------------------------------------------------------------

alter view public.daily_stats set (security_invoker = on);
