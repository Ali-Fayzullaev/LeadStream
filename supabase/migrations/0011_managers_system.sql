-- LeadStream — Step 11: Add managers system.
-- Managers are call center operators who receive and process orders.
-- Each order can be assigned to a manager.

-- Добавляем колонку для маскированного телефона, если её ещё нет
alter table public.orders add column if not exists customer_phone_masked text;

create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  phone text,
  status text not null default 'active' check (status in ('pending', 'active', 'inactive', 'blocked')),
  distribution_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.managers enable row level security;

-- Managers can only see/edit their own profile via the user_id.
create policy "managers_read_own" on public.managers
  for select using (auth.uid() = user_id);

create policy "managers_update_own" on public.managers
  for update using (auth.uid() = user_id);

-- Admin policy for managers table
create policy "managers_admin_all" on public.managers
  for all using (
    auth.jwt()->>'role' = 'service_role' or 
    (select raw_user_meta_data->>'role' from auth.users where id = auth.uid()) = 'admin'
  );

-- Add assigned_manager_id to orders
alter table public.orders add column if not exists assigned_manager_id uuid references public.managers(id) on delete set null;

-- View for managers to see only their assigned orders
create or replace view public.manager_orders as
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
  o.assigned_manager_id,
  m.display_name as manager_name,
  s.display_name as streamer_name
from public.orders o
left join public.managers m on o.assigned_manager_id = m.id
left join public.streamers s on o.streamer_id = s.id;

alter view public.manager_orders set (security_invoker = on);

-- Admin view to see all managers and order distribution
create or replace view public.manager_stats as
select
  m.id,
  m.display_name,
  m.phone,
  m.status,
  m.created_at,
  coalesce(count(o.id), 0)::int as assigned_orders,
  coalesce(count(o.id) filter (where o.status in ('new', 'in_progress')), 0)::int as pending_orders,
  coalesce(count(o.id) filter (where o.status = 'completed'), 0)::int as completed_orders,
  coalesce(count(o.id) filter (where o.status = 'cancelled'), 0)::int as cancelled_orders
from public.managers m
left join public.orders o on o.assigned_manager_id = m.id
group by m.id, m.display_name, m.phone, m.status, m.created_at;

alter view public.manager_stats set (security_invoker = on);

-- Индексы для оптимизации производительности
create index if not exists idx_orders_assigned_manager_id on public.orders(assigned_manager_id);
create index if not exists idx_managers_user_id on public.managers(user_id);
create index if not exists idx_managers_status on public.managers(status);