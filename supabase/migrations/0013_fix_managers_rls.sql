-- LeadStream — Step 13: Fix managers RLS policies and view.
-- The previous migrations (0011, 0012) used raw_user_meta_data / raw_app_meta_data
-- to detect admins, which conflicts with the project convention: admins are
-- identified via public.profiles.role = 'admin' (see public.is_admin()).
-- This migration normalizes everything to use public.is_admin().

-- ---------------------------------------------------------------------------
-- 1. Drop the broken policies from 0011 / 0012
-- ---------------------------------------------------------------------------
drop policy if exists "managers_read_own"        on public.managers;
drop policy if exists "managers_update_own"      on public.managers;
drop policy if exists "managers_admin_all"       on public.managers;

drop policy if exists "managers_see_own_assigned_orders" on public.orders;
drop policy if exists "admin_see_all_orders"             on public.orders;

-- ---------------------------------------------------------------------------
-- 2. Helper: current_manager_id() — analogous to current_streamer_id()
-- ---------------------------------------------------------------------------
create or replace function public.current_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.managers where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3. Re-create RLS policies on managers using is_admin()
-- ---------------------------------------------------------------------------
-- Manager can read their own row
create policy "managers self read" on public.managers
  for select using (user_id = auth.uid() or public.is_admin());

-- Manager can update their own row (limited columns enforced at app layer)
create policy "managers self update" on public.managers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin: full access
create policy "managers admin all" on public.managers
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Extend orders RLS so managers see only their assigned orders
--    (admin policy already exists from 0001: "orders admin all")
-- ---------------------------------------------------------------------------
create policy "orders manager read" on public.orders
  for select using (
    assigned_manager_id is not null
    and assigned_manager_id = public.current_manager_id()
  );

-- Manager can update status of their own assigned orders
create policy "orders manager update status" on public.orders
  for update
  using (
    assigned_manager_id is not null
    and assigned_manager_id = public.current_manager_id()
  )
  with check (
    assigned_manager_id is not null
    and assigned_manager_id = public.current_manager_id()
  );

-- ---------------------------------------------------------------------------
-- 5. Re-create manager_orders view with all fields the app needs.
--    0012 dropped fields used by /admin/managers and /manager pages.
-- ---------------------------------------------------------------------------
drop view if exists public.manager_orders cascade;

create view public.manager_orders as
select
  o.id,
  o.created_at,
  o.updated_at,
  o.streamer_id,
  o.assigned_manager_id,
  o.customer_name,
  -- Mask phone like the streamer view does: first 4 + **** + last 2
  case
    when length(o.customer_phone) >= 6
      then substr(o.customer_phone, 1, greatest(length(o.customer_phone) - 6, 2))
           || repeat('*', 4)
           || substr(o.customer_phone, length(o.customer_phone) - 1)
    else repeat('*', length(o.customer_phone))
  end as customer_phone_masked,
  o.product_name,
  o.quantity,
  o.amount,
  o.status,
  s.display_name as streamer_name,
  m.display_name as manager_name
from public.orders o
left join public.streamers s on s.id = o.streamer_id
left join public.managers  m on m.id = o.assigned_manager_id;

alter view public.manager_orders set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- 6. Re-create manager_stats view (was created in 0011, recreate idempotently)
-- ---------------------------------------------------------------------------
drop view if exists public.manager_stats cascade;

create view public.manager_stats as
select
  m.id,
  m.display_name,
  m.email,
  m.phone,
  m.status,
  m.created_at,
  coalesce(count(o.id), 0)::int                                                    as assigned_orders,
  coalesce(count(o.id) filter (where o.status in ('new', 'confirmed')), 0)::int    as pending_orders,
  coalesce(count(o.id) filter (where o.status = 'completed'), 0)::int              as completed_orders,
  coalesce(count(o.id) filter (where o.status = 'cancelled'), 0)::int              as cancelled_orders
from public.managers m
left join public.orders o on o.assigned_manager_id = m.id
group by m.id;

alter view public.manager_stats set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- 7. updated_at trigger on managers
-- ---------------------------------------------------------------------------
drop trigger if exists set_managers_updated_at on public.managers;
create trigger set_managers_updated_at before update on public.managers
  for each row execute function public.set_updated_at();
