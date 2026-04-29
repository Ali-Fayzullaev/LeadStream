-- LeadStream — initial schema for Supabase
-- ----------------------------------------------------------------------
-- Tables: streamers, orders
-- Auth: uses Supabase auth.users; admins are flagged via public.profiles.role
-- Security: RLS enabled. Public can INSERT orders only; admins can do all.
-- ----------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ===== Profiles (admins) ===============================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'admin' check (role in ('admin')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile row on user signup (first user becomes admin via trigger).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: current user is admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles: self read"  on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: admin all"  on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Streamers =======================================================
create table if not exists public.streamers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  ref_code    text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists streamers_ref_code_idx on public.streamers(ref_code);
create index if not exists streamers_is_active_idx on public.streamers(is_active);

alter table public.streamers enable row level security;

-- Public can read only the minimal data needed by the landing page (active streamers).
create policy "streamers: public read active" on public.streamers
  for select using (is_active = true);
create policy "streamers: admin all" on public.streamers
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Orders ==========================================================
do $$ begin
  create type public.order_status as enum ('NEW', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  customer_phone  text not null,
  product_name    text not null,
  quantity        int  not null default 1 check (quantity > 0),
  amount          numeric(12,2) not null default 0,
  status          public.order_status not null default 'NEW',
  notes           text,
  streamer_id     uuid references public.streamers(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_streamer_idx on public.orders(streamer_id);
create index if not exists orders_created_idx  on public.orders(created_at desc);
create index if not exists orders_status_idx   on public.orders(status);

alter table public.orders enable row level security;

-- Public visitors can place orders, but cannot read them.
create policy "orders: public insert" on public.orders
  for insert with check (true);
create policy "orders: admin all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Updated-at trigger =============================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_streamers_updated_at on public.streamers;
create trigger set_streamers_updated_at before update on public.streamers
  for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ===== Aggregations view (used by dashboard) ===========================
create or replace view public.streamer_stats as
select
  s.id,
  s.name,
  s.ref_code,
  s.is_active,
  s.created_at,
  coalesce(count(o.id), 0)::int      as orders_count,
  coalesce(sum(o.amount), 0)::numeric as revenue
from public.streamers s
left join public.orders o on o.streamer_id = s.id
group by s.id;

-- View inherits RLS from base tables; only admins can SELECT orders, so
-- non-admins effectively get rows with zero counts.
