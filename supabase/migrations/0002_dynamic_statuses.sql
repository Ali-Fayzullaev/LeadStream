-- LeadStream — Step 2: Dynamic order statuses + admin settings
-- Converts orders.status from enum to text and introduces a config table
-- so admins can manage statuses (label, color) at runtime.
-- ---------------------------------------------------------------------------

-- 1. Drop dependent view (will be recreated below).
drop view if exists public.streamer_orders cascade;

-- 2. Convert orders.status from enum to plain text.
alter table public.orders
  alter column status drop default;

alter table public.orders
  alter column status type text using status::text;

alter table public.orders
  alter column status set default 'new';

-- Drop the enum (no longer needed).
drop type if exists public.order_status cascade;

-- 3. Config table for order statuses.
create table if not exists public.order_statuses (
  key         text primary key,
  label       text not null,
  color       text not null default '#3b82f6',         -- HEX, e.g. #10b981
  sort_order  int  not null default 0,
  is_system   boolean not null default false,          -- system rows can't be deleted
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists order_statuses_sort_idx on public.order_statuses(sort_order);

alter table public.order_statuses enable row level security;

-- Policies: read = anyone authenticated, write = admin only.
drop policy if exists "order_statuses read"  on public.order_statuses;
drop policy if exists "order_statuses admin" on public.order_statuses;

create policy "order_statuses read"  on public.order_statuses
  for select using (true);
create policy "order_statuses admin" on public.order_statuses
  for all using (public.is_admin()) with check (public.is_admin());

-- updated_at trigger
drop trigger if exists set_order_statuses_updated_at on public.order_statuses;
create trigger set_order_statuses_updated_at before update on public.order_statuses
  for each row execute function public.set_updated_at();

-- 4. Seed the 5 default statuses (Russian labels, sensible colors).
insert into public.order_statuses (key, label, color, sort_order, is_system)
values
  ('new',       'Новый',         '#3b82f6', 10, true),
  ('confirmed', 'Подтверждён',   '#f59e0b', 20, true),
  ('shipped',   'Отправлен',     '#6366f1', 30, true),
  ('completed', 'Выполнен',      '#10b981', 40, true),
  ('cancelled', 'Отменён',       '#ef4444', 50, true)
on conflict (key) do nothing;

-- 5. Foreign key: orders.status → order_statuses.key (RESTRICT prevents
--    deleting a status that is still in use).
alter table public.orders
  add constraint orders_status_fkey
  foreign key (status) references public.order_statuses(key) on update cascade on delete restrict;

-- 6. Re-create streamer_orders view (status is now text, stays the same).
create or replace view public.streamer_orders as
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
  o.created_at
from public.orders o;
