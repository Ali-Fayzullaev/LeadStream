-- LeadStream — initial schema (Step 1)
-- See docs/04-database-schema.md
-- ---------------------------------------------------------------------------
-- Roles: admin, streamer  (visitors are not authenticated)
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ===========================================================================
-- Clean slate (drops anything left from previous schema versions).
-- Safe to run on a fresh project; on an existing one it will WIPE these tables.
-- ===========================================================================
drop trigger if exists on_auth_user_created on auth.users;

drop view  if exists public.streamer_orders cascade;
drop view  if exists public.streamer_stats  cascade;
drop view  if exists public.daily_stats     cascade;

drop table if exists public.orders          cascade;
drop table if exists public.streamers       cascade;
drop table if exists public.profiles        cascade;

drop function if exists public.handle_new_user()              cascade;
drop function if exists public.is_admin()                     cascade;
drop function if exists public.current_streamer_id()          cascade;
drop function if exists public.generate_unique_ref_code(text) cascade;
drop function if exists public.set_updated_at()               cascade;

drop type if exists public.order_status     cascade;
drop type if exists public.streamer_status  cascade;
drop type if exists public.user_role        cascade;

-- ===========================================================================
-- Enums
-- ===========================================================================
create type public.user_role       as enum ('admin', 'streamer');
create type public.streamer_status as enum ('pending', 'active', 'blocked');
create type public.order_status    as enum ('new', 'confirmed', 'shipped', 'completed', 'cancelled');

-- ===========================================================================
-- profiles  (1:1 with auth.users)
-- ===========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        public.user_role not null default 'streamer',
  full_name   text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ===========================================================================
-- streamers  (extra fields for users with role='streamer')
-- ===========================================================================
create table if not exists public.streamers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,
  display_name        text not null,
  tiktok_username     text,
  ref_code            text not null unique,
  status              public.streamer_status not null default 'pending',
  commission_percent  numeric(5,2) not null default 10.00 check (commission_percent >= 0 and commission_percent <= 100),
  avatar_url          text,
  phone               text,
  notes               text,                       -- internal admin notes (e.g. block reason)
  telegram_chat_id    text,                       -- optional, for streamer notifications
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists streamers_user_idx     on public.streamers(user_id);
create index if not exists streamers_ref_code_idx on public.streamers(ref_code);
create index if not exists streamers_status_idx   on public.streamers(status);

alter table public.streamers enable row level security;

-- ===========================================================================
-- orders
-- ===========================================================================
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  customer_name       text not null,
  customer_phone      text not null,
  product_name        text not null,
  quantity            int  not null default 1 check (quantity > 0),
  amount              numeric(12,2) not null default 0 check (amount >= 0),
  status              public.order_status not null default 'new',
  notes               text,
  streamer_id         uuid references public.streamers(id) on delete set null,
  ref_code_snapshot   text,                       -- ref code at the moment of order
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  ip                  inet,
  user_agent          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists orders_streamer_idx on public.orders(streamer_id);
create index if not exists orders_created_idx  on public.orders(created_at desc);
create index if not exists orders_status_idx   on public.orders(status);
create index if not exists orders_phone_idx    on public.orders(customer_phone);

alter table public.orders enable row level security;

-- ===========================================================================
-- Helpers
-- ===========================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_streamer_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select id from public.streamers where user_id = auth.uid();
$$;

-- Generate a slug-ified ref_code from a desired value, ensuring uniqueness.
create or replace function public.generate_unique_ref_code(desired text)
returns text language plpgsql security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(nullif(desired, ''), 'streamer'), '[^a-z0-9]+', '_', 'gi'));
  base := trim(both '_' from base);
  if base = '' or base is null then base := 'streamer'; end if;
  if length(base) > 32 then base := substr(base, 1, 32); end if;

  candidate := base;
  while exists (select 1 from public.streamers where ref_code = candidate) loop
    n := n + 1;
    candidate := base || '_' || n::text;
  end loop;
  return candidate;
end;
$$;

-- Auto-create profile (and streamer row when role='streamer') on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := coalesce(nullif(meta->>'role', '')::public.user_role, 'streamer');
  v_full_name text := nullif(meta->>'full_name', '');
  v_desired_ref text := nullif(meta->>'desired_ref_code', '');
  v_tiktok text := nullif(meta->>'tiktok_username', '');
  v_ref text;
begin
  insert into public.profiles (id, email, role, full_name)
  values (new.id, new.email, v_role, v_full_name)
  on conflict (id) do nothing;

  if v_role = 'streamer' then
    v_ref := public.generate_unique_ref_code(coalesce(v_desired_ref, v_full_name, split_part(new.email, '@', 1)));
    insert into public.streamers (user_id, display_name, tiktok_username, ref_code, status)
    values (new.id, coalesce(v_full_name, split_part(new.email, '@', 1)), v_tiktok, v_ref, 'pending')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_streamers_updated_at on public.streamers;
create trigger set_streamers_updated_at before update on public.streamers
  for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS policies
-- ===========================================================================

-- profiles -----------------------------------------------------------------
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin all"   on public.profiles;

create policy "profiles self read"   on public.profiles
  for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles admin all"   on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- streamers ----------------------------------------------------------------
drop policy if exists "streamers self read"   on public.streamers;
drop policy if exists "streamers self update" on public.streamers;
drop policy if exists "streamers admin all"   on public.streamers;

create policy "streamers self read" on public.streamers
  for select using (user_id = auth.uid() or public.is_admin());

-- Streamer can edit only safe fields. status and commission_percent must remain unchanged.
create policy "streamers self update" on public.streamers
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status             = (select status             from public.streamers s2 where s2.id = streamers.id)
    and commission_percent = (select commission_percent from public.streamers s2 where s2.id = streamers.id)
    and ref_code           = (select ref_code           from public.streamers s2 where s2.id = streamers.id)
  );

create policy "streamers admin all" on public.streamers
  for all using (public.is_admin()) with check (public.is_admin());

-- orders -------------------------------------------------------------------
drop policy if exists "orders public insert" on public.orders;
drop policy if exists "orders streamer read" on public.orders;
drop policy if exists "orders admin all"     on public.orders;

create policy "orders public insert" on public.orders
  for insert with check (true);

create policy "orders streamer read" on public.orders
  for select using (streamer_id = public.current_streamer_id());

create policy "orders admin all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Views
-- ===========================================================================

-- Streamer-facing orders view: phone is masked.
-- The streamer sees only their own rows because base table RLS already filters.
create or replace view public.streamer_orders as
select
  o.id,
  o.customer_name,
  -- Mask phone: keep first 4 and last 2 chars, e.g. +7 999 ***-**-67
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
  o.created_at
from public.orders o;

-- Per-streamer aggregates for admin dashboard / leaderboard.
create or replace view public.streamer_stats as
select
  s.id,
  s.display_name,
  s.ref_code,
  s.status,
  s.commission_percent,
  s.created_at,
  coalesce(count(o.id), 0)::int                            as orders_count,
  coalesce(sum(o.amount), 0)::numeric(14,2)                as revenue,
  coalesce(sum(o.amount * s.commission_percent / 100), 0)::numeric(14,2) as commission
from public.streamers s
left join public.orders o on o.streamer_id = s.id
group by s.id;

-- Daily aggregates for charts.
create or replace view public.daily_stats as
select
  date_trunc('day', o.created_at)::date as day,
  o.streamer_id,
  count(*)::int                          as orders_count,
  sum(o.amount)::numeric(14,2)           as revenue
from public.orders o
group by 1, 2;
