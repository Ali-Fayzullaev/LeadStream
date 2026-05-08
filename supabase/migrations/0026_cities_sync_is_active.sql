-- ===========================================================================
-- 0026_cities_sync_is_active.sql
-- Унификация активности городов.
--
-- Исторически у разных версий схемы было либо `is_active boolean`, либо
-- `status text`. Это приводит к тому что одни клиенты показывают часть
-- городов, другие — все. Нам нужен ОДИН источник правды и обратная
-- совместимость для уже написанного кода.
--
-- Делаем так:
--   1. Гарантируем существование обеих колонок.
--   2. Заполняем `is_active` из `status` (а если is_active уже стоял —
--      перенесём это в `status`).
--   3. Триггер делает их синхронизированными при будущих обновлениях.
-- ===========================================================================

do $$
begin
  -- Ensure status exists (default 'active')
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='cities' and column_name='status'
  ) then
    alter table public.cities add column status text not null default 'active';
  end if;

  -- Ensure is_active exists (default true)
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='cities' and column_name='is_active'
  ) then
    alter table public.cities add column is_active boolean not null default true;
  end if;
end $$;

-- One-shot reconciliation:
-- If a row has is_active=true but status<>'active', trust is_active.
-- If status='active' but is_active=false, trust status (the new convention).
update public.cities
   set is_active = (status = 'active');

-- Conversely, make sure rows that were is_active=false are also status<>'active'.
update public.cities
   set status = case when is_active then 'active' else 'inactive' end
 where (is_active and status <> 'active')
    or (not is_active and status = 'active');

-- Trigger to keep them in sync going forward.
create or replace function public.cities_sync_active()
returns trigger
language plpgsql
as $$
begin
  -- If status changed, project to is_active
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.is_active := (new.status = 'active');
  end if;
  -- If is_active changed (and status didn't), project to status
  if tg_op = 'UPDATE'
     and new.is_active is distinct from old.is_active
     and new.status is not distinct from old.status then
    new.status := case when new.is_active then 'active' else 'inactive' end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cities_sync_active on public.cities;
create trigger trg_cities_sync_active
  before insert or update on public.cities
  for each row execute function public.cities_sync_active();
