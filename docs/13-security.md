# 13 · Безопасность

## 🛡 Уровни защиты

```
┌─────────────────────────────────────────┐
│ 1. Сетевой / транспорт   (HTTPS, HSTS)  │
├─────────────────────────────────────────┤
│ 2. Application gateway   (rate-limit)   │
├─────────────────────────────────────────┤
│ 3. Auth / сессия         (Supabase JWT) │
├─────────────────────────────────────────┤
│ 4. Authorization         (RLS политики) │
├─────────────────────────────────────────┤
│ 5. Validation            (zod schemas)  │
├─────────────────────────────────────────┤
│ 6. БД-защита             (constraints)  │
└─────────────────────────────────────────┘
```

## 1️⃣ HTTPS

- Vercel и Supabase — HTTPS из коробки.
- Заголовки в `next.config.mjs`:
  - `Strict-Transport-Security: max-age=63072000`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (не даём встраивать в iframe)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 2️⃣ Rate-limiting

In-memory (`src/lib/rate-limit.ts`), достаточно на одну реплику:

| Эндпоинт | Лимит |
|---|---|
| `POST /api/orders` | 10/мин/IP |
| `POST /api/auth/register-streamer` | 5/час/IP |
| `POST /api/auth/login` | 10/мин/IP (Supabase сам ограничивает) |
| Остальное | 60/мин/IP |

Для масштабирования (>1 реплики) — переключить на Upstash Redis.

## 3️⃣ Аутентификация

- Supabase Auth (JWT в httpOnly cookies).
- Refresh-токен ротируется автоматически.
- В `middleware.ts` на каждом запросе:
  - `supabase.auth.getUser()` верифицирует JWT.
  - Защищённые маршруты редиректят на login.
  - Несоответствие роли (`streamer` зашёл в `/admin`) → 403 / редирект.

## 4️⃣ Авторизация: Row Level Security (главное)

Все public-таблицы → `enable row level security`. Без явной политики данные **не видны никому** — это безопасно по умолчанию.

### `orders`
```sql
-- Публичная вставка (форма заказа)
create policy "orders insert public" on orders
  for insert with check (true);

-- Стример видит только свои заказы
create policy "orders select own" on orders
  for select using (
    streamer_id = (select id from streamers where user_id = auth.uid())
  );

-- Админ видит и меняет всё
create policy "orders admin all" on orders
  for all using (is_admin()) with check (is_admin());
```

### `streamers`
```sql
-- Публично читаем только активных и только мин. поля (через view)
-- Полные данные — только сам стример или админ
create policy "streamers self read" on streamers
  for select using (user_id = auth.uid() or is_admin());

create policy "streamers self update" on streamers
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid()
              -- стример не может сам менять статус и комиссию
              and status = (select status from streamers where id = streamers.id)
              and commission_percent = (select commission_percent from streamers where id = streamers.id));

create policy "streamers admin all" on streamers
  for all using (is_admin()) with check (is_admin());
```

### Service-role
- Используется только в `src/lib/supabase/admin.ts` с импортом `'server-only'`.
- Применяется для:
  - Резолва `ref → streamer_id` (потому что публика не видит неактивных).
  - INSERT в `orders` от анонима.
- Никогда не передаётся в client bundle.

## 5️⃣ Валидация входных данных

Zod-схемы в `src/lib/validations.ts` — **те же** на клиенте и сервере. Сервер всегда валидирует повторно.

Особо опасные поля:
- `customer_phone` — regex `^[+0-9()\-\s]{7,20}$`
- `ref` — regex `^[a-z0-9_-]{1,64}$i` (защита от XSS и SQL-инъекций)
- `notes` — max 1000 символов
- HTML в любых текстовых полях экранируется при выводе (React делает это by default).

## 6️⃣ БД-уровень

- `check (quantity > 0)`
- `numeric(12,2)` — никаких float для денег
- FK с `on delete set null` или `restrict` — продумано
- Уникальные индексы (`ref_code`, `email`)
- Никогда не храним пароли — этим занимается Supabase Auth (bcrypt)

## 🔐 Чувствительные данные

| Что | Где хранится | Кто видит |
|---|---|---|
| Пароли | `auth.users` (хэш bcrypt) | никто (даже админ через UI) |
| Service-role ключ | `.env` на сервере | только сервер |
| Telegram token | `.env` на сервере | только сервер |
| Телефон клиента | `orders.customer_phone` | админ полностью; стример с маской |
| IP клиента | `orders.ip` | только админ |

### Маскировка телефона для стримеров

Создаём view:
```sql
create view streamer_orders as
select id, customer_name,
       regexp_replace(customer_phone, '(\+\d+\s*\d{3}).*(\d{2})', '\1 ***-**-\2') as customer_phone_masked,
       product_name, quantity, amount, status, streamer_id, created_at
from orders;
```

Стример читает из `streamer_orders`, не из `orders`.

## 🚨 OWASP Top-10 чеклист

| Угроза | Защита |
|---|---|
| Injection (SQL, XSS) | Параметризованные запросы Supabase + zod + React авто-escape |
| Broken Auth | Supabase Auth + httpOnly cookies + 2FA (roadmap) |
| Sensitive Data Exposure | HTTPS, маскировка телефонов, отсутствие PII в логах |
| XXE | не парсим XML |
| Broken Access Control | RLS на каждой таблице + middleware на каждом маршруте |
| Security Misconfig | HSTS, CSP, нет debug-режима в проде |
| XSS | React, экранирование, CSP |
| Insecure Deserialization | используем JSON, не eval |
| Vulnerable Components | `npm audit` в CI, Dependabot |
| Insufficient Logging | логи в Supabase + Vercel + (roadmap) Sentry |

## 🪵 Логирование и мониторинг

- Vercel logs — runtime ошибки.
- Supabase logs — SQL ошибки, auth события.
- (roadmap) Sentry для frontend / backend exceptions.
- (roadmap) PostHog или Plausible для product-аналитики (без PII).

## 🔁 Бэкапы

- Supabase Pro — daily backups + PITR.
- Self-hosted (docker-compose) — sidecar `pg_dump | gzip` раз в сутки в `./backups`, хранение последних 14.
- Раз в неделю — выгружать копию в S3 (на роадмап).

## 🧪 Тестирование безопасности (roadmap)

- `npm audit` в CI.
- Snyk / Dependabot.
- Lighthouse + Mozilla Observatory ≥ B.
- Pen-test перед публичным запуском.
