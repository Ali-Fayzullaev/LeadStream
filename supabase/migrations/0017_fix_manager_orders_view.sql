-- ===========================================================================
-- 0017_fix_manager_orders_view.sql
-- FULL REPAIR SCRIPT — run this in Supabase SQL Editor
--
-- This script creates everything from scratch in correct order:
-- 1. cities table
-- 2. city_id columns on managers + orders
-- 3. brokers table
-- 4. assigned_broker_id on orders
-- 5. Drop + recreate views
-- 6. Seed cities (Астана, Алматы)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: CITIES TABLE
-- ---------------------------------------------------------------------------
create table if not exists public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;

drop policy if exists "cities_public_read" on public.cities;
create policy "cities_public_read" on public.cities
  for select using (is_active = true);

drop policy if exists "cities_admin_all" on public.cities;
create policy "cities_admin_all" on public.cities
  for all using (
    auth.jwt()->>'role' = 'service_role' or
    (select raw_user_meta_data->>'role' from auth.users where id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- STEP 2: Add missing columns to managers
-- ---------------------------------------------------------------------------
alter table public.managers
  add column if not exists city_id uuid references public.cities(id) on delete set null;

alter table public.managers
  add column if not exists telegram_chat_id text;

alter table public.managers
  add column if not exists temp_password text;

create index if not exists idx_managers_city_id on public.managers(city_id);

-- ---------------------------------------------------------------------------
-- STEP 3: city_id on orders
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists city_id uuid references public.cities(id) on delete set null;

create index if not exists idx_orders_city_id on public.orders(city_id);

-- ---------------------------------------------------------------------------
-- STEP 4: BROKERS TABLE
-- ---------------------------------------------------------------------------
create table if not exists public.brokers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  manager_id       uuid not null references public.managers(id) on delete cascade,
  email            text not null unique,
  display_name     text not null,
  phone            text,
  status           text not null default 'active'
                     check (status in ('active', 'inactive', 'blocked')),
  telegram_chat_id text,
  temp_password    text,
  distribution_count int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.brokers enable row level security;

drop policy if exists "brokers_read_own"    on public.brokers;
drop policy if exists "brokers_update_own"  on public.brokers;
drop policy if exists "brokers_manager_all" on public.brokers;
drop policy if exists "brokers_admin_all"   on public.brokers;

create policy "brokers_read_own" on public.brokers
  for select using (auth.uid() = user_id);

create policy "brokers_update_own" on public.brokers
  for update using (auth.uid() = user_id);

create policy "brokers_manager_all" on public.brokers
  for all using (
    exists (
      select 1 from public.managers m
      where m.id = public.brokers.manager_id
        and m.user_id = auth.uid()
    )
  );

create policy "brokers_admin_all" on public.brokers
  for all using (
    auth.jwt()->>'role' = 'service_role' or
    (select raw_user_meta_data->>'role' from auth.users where id = auth.uid()) = 'admin'
  );

create index if not exists idx_brokers_manager_id on public.brokers(manager_id);
create index if not exists idx_brokers_user_id    on public.brokers(user_id);
create index if not exists idx_brokers_status     on public.brokers(status);

-- ---------------------------------------------------------------------------
-- STEP 5: assigned_broker_id on orders
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists assigned_broker_id uuid references public.brokers(id) on delete set null;

create index if not exists idx_orders_assigned_broker_id on public.orders(assigned_broker_id);

-- ---------------------------------------------------------------------------
-- STEP 6: Drop old views (avoid column rename error)
-- ---------------------------------------------------------------------------
drop view if exists public.broker_orders;
drop view if exists public.manager_orders;

-- ---------------------------------------------------------------------------
-- STEP 7: Recreate manager_orders view
-- ---------------------------------------------------------------------------
create view public.manager_orders as
select
  o.id,
  o.created_at,
  o.streamer_id,
  o.customer_name,
  o.customer_phone,
  o.customer_phone_masked,
  o.product_name,
  o.amount,
  o.status,
  o.city_id,
  o.assigned_manager_id,
  o.assigned_broker_id,
  c.name         as city_name,
  m.display_name as manager_name,
  b.display_name as broker_name,
  s.display_name as streamer_name
from public.orders o
left join public.managers  m on o.assigned_manager_id = m.id
left join public.brokers   b on o.assigned_broker_id  = b.id
left join public.cities    c on o.city_id             = c.id
left join public.streamers s on o.streamer_id         = s.id;

alter view public.manager_orders set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- STEP 8: Recreate broker_orders view
-- ---------------------------------------------------------------------------
create view public.broker_orders as
select
  o.id,
  o.created_at,
  o.customer_name,
  o.customer_phone,
  o.customer_phone_masked,
  o.product_name,
  o.amount,
  o.status,
  o.city_id,
  o.assigned_manager_id,
  o.assigned_broker_id,
  c.name         as city_name,
  m.display_name as manager_name,
  s.display_name as streamer_name
from public.orders o
left join public.managers  m on o.assigned_manager_id = m.id
left join public.cities    c on o.city_id             = c.id
left join public.streamers s on o.streamer_id         = s.id;

alter view public.broker_orders set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- STEP 9: Seed cities
-- ---------------------------------------------------------------------------
insert into public.cities (name, slug, is_active) values
  ('Астана',  'astana',  true),
  ('Алматы',  'almaty',  true)
on conflict (slug) do update set
  name      = excluded.name,
  is_active = excluded.is_active;
