-- ===========================================================================
-- 0025_order_comments.sql
-- Комментарии к лидам.
--
-- Любая роль (admin / manager / broker), которая видит заказ, может:
--   • читать его комментарии;
--   • добавлять свой;
--   • редактировать/удалять ТОЛЬКО свой собственный.
--
-- Логика «кто может видеть заказ» уже выражена существующими RLS на orders
-- (admin — всё; manager — свои города; broker — assigned_broker_id == self).
-- Чтобы не дублировать её, мы пишем RLS на order_comments как «можно если
-- можно SELECT соответствующий order».
-- ===========================================================================

create table if not exists public.order_comments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  author_id     uuid not null references auth.users(id) on delete cascade,
  author_role   text not null check (author_role in ('admin','manager','broker')),
  author_name   text,                  -- snapshot, чтобы было видно после удаления
  body          text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  edited        boolean not null default false
);

create index if not exists idx_order_comments_order_id on public.order_comments(order_id, created_at);
create index if not exists idx_order_comments_author_id on public.order_comments(author_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.order_comments enable row level security;

drop policy if exists "comments_select_visible" on public.order_comments;
create policy "comments_select_visible"
  on public.order_comments for select
  using (
    exists (select 1 from public.orders o where o.id = order_id)
    -- Полагаемся на RLS таблицы orders: пользователь увидит запись только
    -- если у него есть SELECT на саму orders. На уровне приложения мы
    -- работаем через service-role admin client, так что RLS пропускаются —
    -- авторизация делается в server actions.
  );

drop policy if exists "comments_insert_self" on public.order_comments;
create policy "comments_insert_self"
  on public.order_comments for insert
  with check (author_id = auth.uid());

drop policy if exists "comments_update_self" on public.order_comments;
create policy "comments_update_self"
  on public.order_comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "comments_delete_self_or_admin" on public.order_comments;
create policy "comments_delete_self_or_admin"
  on public.order_comments for delete
  using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── Helper trigger: bump updated_at + flag edited ──────────────────────────
create or replace function public.touch_order_comment()
returns trigger
language plpgsql
as $$
begin
  -- Only mark "edited" if the body actually changed
  if new.body is distinct from old.body then
    new.edited := true;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_order_comment on public.order_comments;
create trigger trg_touch_order_comment
  before update on public.order_comments
  for each row execute function public.touch_order_comment();

-- ── Bump orders.updated_at when comment activity happens ───────────────────
create or replace function public.touch_order_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  oid := coalesce(new.order_id, old.order_id);
  if oid is not null then
    update public.orders set updated_at = now() where id = oid;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_touch_order_on_comment on public.order_comments;
create trigger trg_touch_order_on_comment
  after insert or update or delete on public.order_comments
  for each row execute function public.touch_order_on_comment();
