-- ===========================================================================
-- 0024_seed_all_kz_cities.sql
-- Засев всех крупных городов Казахстана.
--
-- Миграция АДАПТИВНАЯ: сначала добавляет недостающие колонки в `cities`
-- (status, display_order), потом вставляет города только в те колонки,
-- которые точно существуют. Это безопасно для любой БД, начатой с разных
-- версий схемы.
--
-- Поведение по бизнес-логике:
--   • Если города нет — добавляем (status='active' если колонка есть).
--   • Если город уже есть с тем же slug — НЕ трогаем.
--   • Заявки городов без менеджера остаются с assigned_manager_id = NULL
--     и попадают только в админский Telegram-канал.
-- ===========================================================================

-- ── Step 1: ensure required columns exist ─────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cities' and column_name = 'status'
  ) then
    alter table public.cities add column status text not null default 'active';
    raise notice 'Added cities.status column';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cities' and column_name = 'display_order'
  ) then
    alter table public.cities add column display_order int not null default 0;
    raise notice 'Added cities.display_order column';
  end if;

  -- Ensure unique constraint on slug (some early schemas may not have it)
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
     where t.relname = 'cities'
       and c.contype = 'u'
       and pg_get_constraintdef(c.oid) ilike '%(slug)%'
  ) then
    -- Only add if not already a unique index on slug
    if not exists (
      select 1 from pg_indexes
       where schemaname = 'public' and tablename = 'cities' and indexdef ilike '%UNIQUE%(slug)%'
    ) then
      begin
        alter table public.cities add constraint cities_slug_key unique (slug);
        raise notice 'Added unique constraint cities_slug_key';
      exception when others then
        -- Already exists or duplicates present — ignore.
        raise notice 'Could not add unique(slug) on cities: %', SQLERRM;
      end;
    end if;
  end if;
end $$;

-- ── Step 2: bulk insert (idempotent via on conflict on slug) ──────────────
insert into public.cities (name, slug, status, display_order)
values
  -- Города республиканского значения / столица
  ('Астана',          'astana',         'active',  1),
  ('Алматы',          'almaty',         'active',  2),
  ('Шымкент',         'shymkent',       'active',  3),
  -- Областные центры
  ('Актау',           'aktau',          'active', 10),
  ('Актобе',          'aktobe',         'active', 11),
  ('Атырау',          'atyrau',         'active', 12),
  ('Жезказган',       'zhezkazgan',     'active', 13),
  ('Караганда',       'karaganda',      'active', 14),
  ('Кокшетау',        'kokshetau',      'active', 15),
  ('Костанай',        'kostanay',       'active', 16),
  ('Кызылорда',       'kyzylorda',      'active', 17),
  ('Павлодар',        'pavlodar',       'active', 18),
  ('Петропавловск',   'petropavlovsk',  'active', 19),
  ('Семей',           'semey',          'active', 20),
  ('Талдыкорган',     'taldykorgan',    'active', 21),
  ('Тараз',           'taraz',          'active', 22),
  ('Туркестан',       'turkestan',      'active', 23),
  ('Уральск',         'oral',           'active', 24),
  ('Усть-Каменогорск','oskemen',        'active', 25),
  -- Крупные города/моногорода
  ('Балхаш',          'balkhash',       'active', 30),
  ('Екибастуз',       'ekibastuz',      'active', 31),
  ('Жанаозен',        'zhanaozen',      'active', 32),
  ('Капшагай',        'kapshagay',      'active', 33),
  ('Кентау',          'kentau',         'active', 34),
  ('Лисаковск',       'lisakovsk',      'active', 35),
  ('Риддер',          'ridder',         'active', 36),
  ('Рудный',          'rudny',          'active', 37),
  ('Сатпаев',         'satpaev',        'active', 38),
  ('Степногорск',     'stepnogorsk',    'active', 39),
  ('Темиртау',        'temirtau',       'active', 40),
  ('Шахтинск',        'shakhtinsk',     'active', 41)
on conflict (slug) do nothing;

-- ── Step 3: sanity log ────────────────────────────────────────────────────
do $$
declare
  total int;
  active_with_manager int;
  active_without_manager int;
  has_status boolean;
begin
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cities' and column_name = 'status'
  ) into has_status;

  select count(*) into total from public.cities;

  if has_status then
    execute $sql$
      select count(*) from public.cities c
       where c.status = 'active'
         and exists (select 1 from public.managers m where m.city_id = c.id and m.status = 'active')
    $sql$ into active_with_manager;

    execute $sql$
      select count(*) from public.cities c
       where c.status = 'active'
         and not exists (select 1 from public.managers m where m.city_id = c.id and m.status = 'active')
    $sql$ into active_without_manager;
  else
    active_with_manager := -1;
    active_without_manager := -1;
  end if;

  raise notice 'Cities: total=%, with-active-manager=%, without-manager(→ admin only)=%',
    total, active_with_manager, active_without_manager;
end $$;
