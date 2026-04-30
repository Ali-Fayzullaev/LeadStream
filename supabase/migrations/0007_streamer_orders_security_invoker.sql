-- 0007_streamer_orders_security_invoker.sql
-- ---------------------------------------------------------------------------
-- Fix: streamer_orders view was running with view-owner privileges, which
-- bypassed Row Level Security on the underlying `orders` table — so every
-- authenticated streamer could SELECT every order via the view.
--
-- Postgres 15+ supports the `security_invoker` view option which makes the
-- view run with the privileges (and RLS) of the *caller* instead of the owner.
-- That re-applies the RLS policy `orders streamer read` (streamer_id =
-- public.current_streamer_id()), so each streamer sees only their own rows.
-- Admin still sees everything via `orders admin all`.
-- ---------------------------------------------------------------------------

alter view public.streamer_orders set (security_invoker = on);
alter view public.streamer_stats  set (security_invoker = on);
