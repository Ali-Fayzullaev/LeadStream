-- 0027_streamer_can_set_city.sql
-- ---------------------------------------------------------------------------
-- Goal: streamers can see in their cabinet which of THEIR orders are still
-- "unassigned" (city_id IS NULL, i.e. came from a landing page where the
-- visitor didn't pick a city), and they can fill the city themselves so the
-- order gets routed to a manager/broker.
--
-- Changes:
--   1. `streamer_orders` view exposes `city_id` and `city_name` so the
--      streamer cabinet can render them and offer a city picker.
--   2. RLS policy on `orders` allows a streamer to UPDATE *only* the
--      `city_id` column of THEIR OWN orders, and *only* when it is
--      currently NULL. They cannot reassign an already-assigned order.
-- ---------------------------------------------------------------------------

-- 1. Recreate `streamer_orders` view with city info ---------------------------
drop view if exists public.streamer_orders cascade;

create view public.streamer_orders
with (security_invoker = on)
as
select
  o.id,
  o.customer_name,
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
  o.streamer_id,
  o.ref_code_snapshot,
  o.city_id,
  c.name as city_name,
  o.assigned_manager_id,
  o.assigned_broker_id,
  o.created_at
from public.orders o
left join public.cities c on c.id = o.city_id;

grant select on public.streamer_orders to authenticated, anon;

-- 2. RLS: streamer can UPDATE only city_id, only on own unassigned orders -----
--
-- We don't have column-level RLS in vanilla Postgres, so we enforce the
-- "only city_id changed" rule via a trigger. The policy itself only
-- decides WHICH rows are visible for UPDATE.

drop policy if exists "streamer can set city on own unassigned order" on public.orders;

create policy "streamer can set city on own unassigned order"
  on public.orders
  for update
  to authenticated
  using (
    -- Visible-for-update predicate (pre-update row state)
    streamer_id is not null
    and streamer_id = (
      select s.id from public.streamers s where s.user_id = auth.uid()
    )
    and city_id is null
  )
  with check (
    -- Post-update predicate: still has to be MY order, and now city must
    -- be set (i.e. they actually filled it in)
    streamer_id = (
      select s.id from public.streamers s where s.user_id = auth.uid()
    )
    and city_id is not null
  );

-- 3. Trigger: forbid changing anything except city_id (+ updated_at) for the
--    streamer-update case. Admins / service_role bypass RLS so this only
--    fires for normal authenticated streamer updates.

create or replace function public.enforce_streamer_only_changes_city()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_streamer_update boolean;
begin
  -- Skip when running as service_role / postgres (no RLS) or as admin.
  -- `current_setting('request.jwt.claim.role', true)` returns 'authenticated'
  -- for normal users, 'service_role' for the admin client, NULL outside RLS.
  if current_setting('request.jwt.claim.role', true) is distinct from 'authenticated' then
    return new;
  end if;

  -- Admins are allowed to update freely.
  if public.is_admin() then
    return new;
  end if;

  -- For everyone else hitting this trigger as 'authenticated', only allow
  -- changes that match the "streamer fills in city" shape:
  --   - city_id transitions NULL -> not NULL
  --   - assigned_manager_id / assigned_broker_id may be set
  --     (server-side action will do this via service_role anyway, but be safe)
  --   - all other columns must be untouched
  is_streamer_update := (old.city_id is null and new.city_id is not null);

  if not is_streamer_update then
    raise exception 'Streamers can only set city on unassigned orders' using errcode = '42501';
  end if;

  if  new.id              is distinct from old.id
   or new.customer_name   is distinct from old.customer_name
   or new.customer_phone  is distinct from old.customer_phone
   or new.product_name    is distinct from old.product_name
   or new.quantity        is distinct from old.quantity
   or new.amount          is distinct from old.amount
   or new.status          is distinct from old.status
   or new.streamer_id     is distinct from old.streamer_id
   or new.ref_code_snapshot is distinct from old.ref_code_snapshot
   or new.ip              is distinct from old.ip
   or new.user_agent      is distinct from old.user_agent
   or new.created_at      is distinct from old.created_at
  then
    raise exception 'Streamers can only change city_id (and routing fields)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_streamer_only_changes_city on public.orders;
create trigger trg_enforce_streamer_only_changes_city
  before update on public.orders
  for each row execute function public.enforce_streamer_only_changes_city();
