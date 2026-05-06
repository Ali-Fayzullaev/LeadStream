-- ===========================================================================
-- 0016_cities_brokers_system.sql
-- Adds: cities, brokers, city routing for orders/managers
-- Run this ENTIRE script in Supabase SQL Editor
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. CITIES
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

insert into public.cities (name, slug) values ('Астана', 'astana')
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Add city_id to managers
-- ---------------------------------------------------------------------------
alter table public.managers
  add column if not exists city_id uuid references public.cities(id) on delete set null;

create index if not exists idx_managers_city_id on public.managers(city_id);

-- ---------------------------------------------------------------------------
-- 3. Add city_id to orders (for routing)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists city_id uuid references public.cities(id) on delete set null;

create index if not exists idx_orders_city_id on public.orders(city_id);

-- ---------------------------------------------------------------------------
-- 4. BROKERS
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
-- 5. Add assigned_broker_id to orders
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists assigned_broker_id uuid references public.brokers(id) on delete set null;

create index if not exists idx_orders_assigned_broker_id on public.orders(assigned_broker_id);

-- ---------------------------------------------------------------------------
-- 6. Recreate manager_orders view (drop first to avoid column rename error)
-- ---------------------------------------------------------------------------
drop view if exists public.broker_orders;
drop view if exists public.manager_orders;

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
-- 7. Broker orders view
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
