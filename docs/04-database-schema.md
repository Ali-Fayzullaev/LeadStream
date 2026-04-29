# 04 · Схема базы данных

## 🗃 Таблицы

### `auth.users` (управляется Supabase Auth)
Содержит email + хэш пароля. Мы её **не трогаем**, только ссылаемся.

### `public.profiles`
Профили **всех** залогиненных пользователей (и стримеров, и админов). 1:1 с `auth.users`.

| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK FK→auth.users | id пользователя |
| email | text | email (дубль для удобства) |
| role | enum (`admin`, `streamer`) | роль |
| full_name | text | ФИО |
| created_at | timestamptz | дата создания |

### `public.streamers`
Расширяет профиль стримера дополнительными полями.

| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | id стримера |
| user_id | uuid FK→auth.users (UNIQUE) | связь с auth |
| display_name | text | публичное имя |
| tiktok_username | text | @ник в тиктоке |
| ref_code | text UNIQUE | реф-код в URL (`?ref=alex`) |
| status | enum (`pending`, `active`, `blocked`) | статус |
| commission_percent | numeric(5,2) | % с заказа (default 10.00) |
| avatar_url | text | аватар |
| phone | text | телефон |
| notes | text | внутренние заметки админа |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `public.products` (на будущее, в MVP — один товар захардкожен)
| Поле | Тип |
|---|---|
| id | uuid PK |
| name | text |
| description | text |
| price | numeric(12,2) |
| image_url | text |
| is_active | boolean |
| created_at | timestamptz |

### `public.orders`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| customer_name | text | имя клиента |
| customer_phone | text | телефон |
| product_id | uuid FK→products | товар (nullable пока MVP) |
| product_name | text | snapshot названия |
| quantity | int | кол-во |
| amount | numeric(12,2) | сумма |
| status | enum | `new`, `confirmed`, `shipped`, `completed`, `cancelled` |
| streamer_id | uuid FK→streamers (nullable) | привязка |
| ref_code_snapshot | text | какой ref был в момент заказа |
| utm_source, utm_medium, utm_campaign | text | для расширенной аналитики |
| ip | inet | IP посетителя (для антифрода) |
| user_agent | text | |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `public.payouts` (roadmap)
Выплаты стримерам.

| Поле | Тип |
|---|---|
| id | uuid PK |
| streamer_id | uuid FK→streamers |
| period_start | date |
| period_end | date |
| orders_count | int |
| revenue | numeric(12,2) |
| commission_amount | numeric(12,2) |
| status | enum (`pending`, `paid`) |
| paid_at | timestamptz |
| created_at | timestamptz |

## 🔍 Индексы

```sql
create index streamers_ref_code_idx on streamers(ref_code);
create index streamers_user_idx on streamers(user_id);
create index streamers_status_idx on streamers(status);

create index orders_streamer_idx on orders(streamer_id);
create index orders_created_idx on orders(created_at desc);
create index orders_status_idx on orders(status);
create index orders_phone_idx on orders(customer_phone); -- поиск по телефону
```

## 🛡 Row Level Security (RLS)

### `profiles`
- SELECT: пользователь видит только свой профиль; админ видит все.
- UPDATE: пользователь меняет только свой; админ меняет любой.

### `streamers`
- SELECT (публично): любой может читать `display_name, ref_code` активных стримеров (для атрибуции на лендинге).
- SELECT (полные данные): сам стример видит свою запись; админ — все.
- INSERT: автоматически при регистрации (через триггер `handle_new_user`).
- UPDATE: стример меняет свои `display_name, tiktok_username, avatar_url`; админ меняет всё, включая `status` и `commission_percent`.
- DELETE: только админ.

### `orders`
- INSERT (публично): кто угодно может создать (форма заказа).
- SELECT (стример): только свои заказы (`streamer_id = (select id from streamers where user_id = auth.uid())`).
- SELECT (админ): все.
- UPDATE/DELETE: только админ.

### `payouts`
- SELECT: стример видит свои; админ — все.
- INSERT/UPDATE/DELETE: только админ.

## 🔧 Триггеры и функции

### Авто-создание профиля при регистрации
```sql
create function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, email, role, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'role', 'streamer'),
          new.raw_user_meta_data->>'full_name');
  return new;
end; $$ language plpgsql security definer;
```

### Авто-создание `streamers` для роли `streamer`
В том же триггере — если `role='streamer'`, создаём запись в `streamers` со статусом `pending` и сгенерированным `ref_code`.

### Хелпер `is_admin()`
```sql
create function is_admin() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql stable;
```

### Триггер `updated_at`
Автоматически проставляет `updated_at = now()` на UPDATE.

## 📊 Views для аналитики

### `streamer_stats`
Агрегаты по стримеру для лидерборда.

```sql
create view streamer_stats as
select
  s.id, s.display_name, s.ref_code, s.status,
  count(o.id) as orders_count,
  coalesce(sum(o.amount), 0) as revenue,
  coalesce(sum(o.amount * s.commission_percent / 100), 0) as commission
from streamers s
left join orders o on o.streamer_id = s.id
group by s.id;
```

### `daily_stats` (для графиков)
```sql
create view daily_stats as
select
  date_trunc('day', created_at)::date as day,
  streamer_id,
  count(*) as orders,
  sum(amount) as revenue
from orders
group by 1, 2;
```
