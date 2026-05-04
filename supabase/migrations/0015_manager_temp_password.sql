-- ===========================================================================
-- 0015_manager_temp_password.sql
-- Add temp_password column to managers table so admin can see/copy it.
-- Only admins (service_role) can read this column.
-- ===========================================================================

alter table public.managers
  add column if not exists temp_password text;

comment on column public.managers.temp_password is
  'Temporary plain-text password set by admin at creation. Admin should share it with the manager and the manager should change it on first login.';
