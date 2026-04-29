# LeadStream

Платформа для отслеживания клиентов, приведённых TikTok-стримерами.
Полное ТЗ: [docs/README.md](docs/README.md)

## � Маршруты

### Публичные (без логина)
| URL | Назначение |
|---|---|
| `/` | Лендинг + форма заказа. `?ref=<code>` ставит cookie `ls_ref` (30 дней) и показывает «Referred by …». |
| `/?ref=<code>` | То же, с реф-привязкой к стримеру. |
| `/thanks?id=<orderId>` | Спасибо-страница после оформления. |
| `/robots.txt`, `/sitemap.xml` | SEO. |

### Стример (роль `streamer`)
| URL | Назначение |
|---|---|
| `/streamer/register` | **Регистрация стримера** (full name, TikTok @, email, password ≥ 8, ref-code). Создаёт `pending` аккаунт. |
| `/streamer/login` | **Логин стримера**. |
| `/streamer/pending` | Страница «Account under review» — пока админ не активировал. |
| `/streamer/blocked` | Если админ заблокировал. |
| `/streamer` | Дашборд: 3 KPI, график 14 дней, реф-линк + QR, последние 5 заказов. |
| `/streamer/orders` | Все свои заказы (телефон замаскирован), пагинация. |
| `/streamer/profile` | Редактирование display_name / TikTok / phone / avatar / telegram_chat_id. |

### Админ (роль `admin`)
| URL | Назначение |
|---|---|
| `/admin/login` | **Логин админа**. |
| `/admin` | Дашборд: 4 KPI, 30-дневный график, лидерборд топ-10. |
| `/admin/streamers` | Все стримеры: создание (+ Add streamer), Approve/Block/Unblock, inline-редактирование ref_code/commission/status. |
| `/admin/orders` | Все заказы: фильтры (статус/стример/поиск/даты), смена статуса, удаление, пагинация. |
| `/api/admin/orders/export?…` | Скачать XLSX с теми же фильтрами. |

### API
| URL | Метод | Назначение |
|---|---|---|
| `/api/orders` | POST | Публичное создание заказа. Реф из тела или cookie. Rate-limit 5/мин/IP. Telegram-уведомление. |
| `/api/admin/orders/export` | GET | Только админ. XLSX. |

## �🟢 Текущий статус: Готово (Шаги 1–6)

✅ Шаги 1–5: фундамент, auth, лендинг+реф-трекинг+форма заказа, кабинет стримера, админ-панель.

✅ Сделано в Шаге 6 (полировка):
- [src/app/not-found.tsx](src/app/not-found.tsx) — кастомная 404.
- [src/app/error.tsx](src/app/error.tsx) — глобальный error boundary (рендерится при необработанных ошибках на любой странице).
- [src/app/admin/error.tsx](src/app/admin/error.tsx) + [src/app/streamer/error.tsx](src/app/streamer/error.tsx) — локальные error boundaries для двух кабинетов (показывают «Retry» вместо падения всей сессии).
- [src/app/loading.tsx](src/app/loading.tsx), [src/app/admin/loading.tsx](src/app/admin/loading.tsx), [src/app/streamer/loading.tsx](src/app/streamer/loading.tsx) — skeleton-плейсхолдеры пока RSC грузит данные.
- [src/app/robots.ts](src/app/robots.ts) — Allow `/`, `/thanks`; Disallow `/admin`, `/streamer`, `/api`.
- [src/app/sitemap.ts](src/app/sitemap.ts) — публичные URL.
- [src/app/(auth)/actions.ts](src/app/(auth)/actions.ts) — добавлен IP rate-limit на login (10 / 5 мин) и register (5 / час).

### Проверка Шага 6

```
GET /robots.txt              → 200, Disallow /admin /streamer /api
GET /sitemap.xml             → 200, /, /thanks
GET /some-missing-page       → 404 (наша not-found.tsx)
```

11+ login-попыток за 5 мин с одного IP → ответ «Too many login attempts. Try again in a few minutes.»

⏭ Дальше: deploy.

## 🚢 Деплой (Vercel + Supabase)

1. **Supabase**: применить миграции к проду (см. ниже), создать админа.
2. **Vercel** → Import Git Repo → Framework: Next.js. Без кастомных команд.
3. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)
   - `NEXT_PUBLIC_APP_URL` = `https://your-domain.com`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (опционально)
4. **Supabase → Auth → URL Configuration**: Site URL = `https://your-domain.com`,
   Redirect URLs добавить `https://your-domain.com/streamer/login`.
5. Deploy → проверить `/robots.txt`, `/sitemap.xml`, `/admin/login`, `/streamer/login`.

> **Замечание про rate-limit.** Текущая реализация in-memory ([src/lib/rate-limit.ts](src/lib/rate-limit.ts))
> работает на одном инстансе. При масштабировании Vercel/serverless заменить на Upstash Redis
> (см. комментарий в файле).

## 🚀 Запуск локально

### 1. Установка зависимостей

```powershell
npm install
```

### 2. Переменные окружения

`.env` уже создан. Если нет — скопируйте из примера:

```powershell
Copy-Item .env.example .env
```

Заполните `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` из вашего проекта Supabase.

### 3. Применить миграции к Supabase

#### Вариант A — Supabase CLI (рекомендуется)

```powershell
npx supabase login
npx supabase link --project-ref <YOUR-PROJECT-REF>
npx supabase db push
```

#### Вариант B — вручную через SQL Editor

1. Откройте Supabase Dashboard → SQL Editor.
2. Вставьте содержимое [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
3. Run.

### 4. Создать первого админа

#### Способ A — одной командой (рекомендуется)

```powershell
npm run create-admin -- --email admin@yourcompany.com --password "S3cret!Pass" --name "Owner"
```

Скрипт ([scripts/create-admin.mjs](scripts/create-admin.mjs)) использует `SUPABASE_SERVICE_ROLE_KEY`:
- создаёт пользователя в `auth.users` (email сразу подтверждён);
- если пользователь уже существует — обновляет пароль и делает админом;
- ставит `profiles.role = 'admin'`;
- удаляет авто-созданную строку в `streamers` (триггер создаёт её для всех новых юзеров).

После этого вход на `/admin/login` теми же email/паролем.

#### Способ B — вручную через Supabase Dashboard

1. **Authentication → Users → Add user**
   - Email + Password
   - **Auto Confirm User: ON**
2. **SQL Editor:**
   ```sql
   update public.profiles
      set role = 'admin'
    where email = 'admin@yourcompany.com';

   delete from public.streamers
    where user_id = (select id from auth.users where email = 'admin@yourcompany.com');
   ```

### 5. Запустить dev-сервер

```powershell
npm run dev
```

Откройте http://localhost:3000

## ✅ Проверка Шага 4

1. Войти стримером (status=`active`) на `/streamer/login` → кабинет `/streamer`.
2. Должны быть: 3 KPI-карточки, график за 14 дней, карточка реф-линка с QR, список последних заказов (телефон замаскирован).
3. Нажать «Copy link» → в буфере `https://…/?ref=<ваш код>`.
4. Открыть `/streamer/orders` → полный список с пагинацией, ряды видны только свои (RLS).
5. Открыть `/streamer/profile` → поменять display_name, telegram_chat_id, сохранить → тост успеха.
   Попытка изменить `ref_code` / `commission_percent` / `status` через DevTools будет отклонена RLS.
6. Новый заказ через `/?ref=<ваш код>` → KPI и график обновятся при перезагрузке.

## ✅ Проверка Шага 3

1. Открыть http://localhost:3000 — виден лендинг с формой, без бейджа «Referred by».
2. Сделать стримера active (см. Проверка Шага 2). Для примера ref-code = `alex_2024`.
3. Открыть http://localhost:3000/?ref=alex_2024 — cookie `ls_ref=alex_2024` проставится втоматически; появятся бейдж «Referred by Alex …».
4. Заполнить форму (имя, телефон) и отправить. Редирект на `/thanks?id=…`.
5. В Supabase Dashboard → Table Editor → `orders` появится запись с `streamer_id` и `ref_code_snapshot`.
6. Если заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` — в чат прилетит уведомление.
7. Заказ без cookie / с неизвестным ref → создаётся «direct» (`streamer_id=null`).
8. 6+ POST на `/api/orders` за минуту с одного IP → 6-й вернёт 429.

## ✅ Проверка Шага 2

1. `npm run dev` поднимается без ошибок.
2. Открыть http://localhost:3000/streamer/register — заполнить форму
   (full name, email, password ≥ 8, ref-code 3–32 символа `[a-z0-9_-]`).
   После отправки появится экран «Check your email».
3. Подтвердить email (или включить **Auto Confirm** в Supabase Dashboard для ускорения).
4. В таблице `public.streamers` появится запись `status='pending'`, в `public.profiles` — `role='streamer'`.
5. Зайти на `/streamer/login` под этим аккаунтом → должно редиректнуть на `/streamer/pending`
   («Account under review»).
6. В SQL Editor выполнить:
   ```sql
   update public.streamers set status = 'active'
    where user_id = (select id from auth.users where email = '<streamer email>');
   ```
7. Перезагрузить `/streamer` → теперь видно карточку «Welcome, …» с реф-кодом.
8. `/admin/login` под админом из Шага 1 → попадаем на `/admin` со заглушкой dashboard.
9. Логин стримера на `/admin/login` (и наоборот) показывает ошибку «account is not an admin».
10. Кнопка **Sign out** в шапке выкидывает на главную.

## ✅ Проверка Шага 1

- `npm run dev` запускается без ошибок компиляции.
- На главной странице показывается «Step 1 · Foundation ready».
- В Supabase Dashboard видно таблицы `profiles`, `streamers`, `orders` и view
  `streamer_orders`, `streamer_stats`, `daily_stats`.
- Запрос `select role from public.profiles where email = 'admin@yourcompany.com';`
  возвращает `admin`.
- `/login` редиректит на `/streamer/login` (страница появится в Шаге 2 — пока 404 ожидаем).

## 📚 Документация

| Раздел | Файл |
|---|---|
| Содержание ТЗ | [docs/README.md](docs/README.md) |
| Проблема и решение | [docs/00-problem-and-solution.md](docs/00-problem-and-solution.md) |
| Роли и сценарии | [docs/01-roles-and-user-flows.md](docs/01-roles-and-user-flows.md) |
| Стек | [docs/02-tech-stack.md](docs/02-tech-stack.md) |
| Архитектура | [docs/03-architecture.md](docs/03-architecture.md) |
| Схема БД | [docs/04-database-schema.md](docs/04-database-schema.md) |
| Авторизация | [docs/05-auth.md](docs/05-auth.md) |
| Лендинг | [docs/06-public-landing.md](docs/06-public-landing.md) |
| Реф-трекинг | [docs/07-referral-tracking.md](docs/07-referral-tracking.md) |
| Кабинет стримера | [docs/08-streamer-cabinet.md](docs/08-streamer-cabinet.md) |
| Админ-панель | [docs/09-admin-dashboard.md](docs/09-admin-dashboard.md) |
| API | [docs/10-api.md](docs/10-api.md) |
| Дизайн-система | [docs/11-design-system.md](docs/11-design-system.md) |
| Уведомления | [docs/12-notifications.md](docs/12-notifications.md) |
| Безопасность | [docs/13-security.md](docs/13-security.md) |
| Деплой | [docs/14-deployment.md](docs/14-deployment.md) |
| Roadmap | [docs/15-roadmap.md](docs/15-roadmap.md) |
