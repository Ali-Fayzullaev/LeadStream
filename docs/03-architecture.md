# 03 · Архитектура

## 🏗 Высокоуровневая схема

```
┌──────────────────────────────────────────────────────────────┐
│                      Браузер (клиент)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │  Лендинг /  │  │ Кабинет      │  │ Админ-панель     │     │
│  │ форма заказа│  │  стримера    │  │                  │     │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘     │
│         │                │                   │               │
└─────────┼────────────────┼───────────────────┼───────────────┘
          │                │                   │
          │  HTTPS         │  HTTPS            │  HTTPS
          ▼                ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    Next.js 14 (Vercel)                       │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Server         │  │  API Routes  │  │ Middleware   │      │
│  │ Components     │  │  /api/*      │  │ (auth guard) │      │
│  └────────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└───────────┼─────────────────┼─────────────────┼──────────────┘
            │                 │                 │
            │ supabase-js     │ rate-limit      │ session check
            ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────┐
│                          Supabase                            │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────────┐    │
│  │ Postgres │  │   Auth   │  │ Storage│  │  Realtime    │    │
│  │ + RLS    │  │  (JWT)   │  │ (файлы)│  │ (подписки)   │    │
│  └──────────┘  └──────────┘  └────────┘  └──────────────┘    │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS (только на новый заказ)
                          ▼
                  ┌─────────────────┐
                  │  Telegram Bot   │
                  │  (notifications)│
                  └─────────────────┘
```

## 🔐 Где какая авторизация

| Слой | Кто | Как |
|---|---|---|
| Запрос на чтение/запись своих данных | Стример | JWT cookie от Supabase + RLS проверяет `auth.uid() = streamer.user_id` |
| Запрос на чтение всего | Админ | RLS проверяет `is_admin(auth.uid()) = true` |
| Создание заказа (публично) | Кто угодно | RLS-политика `INSERT with check (true)` |
| Чувствительные операции (Telegram, экспорт) | Сервер | API Route + service-role ключ |

## 🧩 Слои приложения

```
┌────────────────────────────────────────────┐
│  UI (компоненты, страницы)                 │ ← Tailwind + shadcn/ui
├────────────────────────────────────────────┤
│  Hooks / клиентская логика                 │ ← React, react-hook-form
├────────────────────────────────────────────┤
│  Server Actions / API Routes               │ ← Next.js
├────────────────────────────────────────────┤
│  lib/                                      │
│    ├── supabase/{client,server,admin}.ts   │
│    ├── validations.ts (zod)                │
│    ├── rate-limit.ts                       │
│    ├── telegram.ts                         │
│    └── utils.ts                            │
├────────────────────────────────────────────┤
│  Supabase (Postgres + RLS + Auth)          │
└────────────────────────────────────────────┘
```

## 🗂 Структура файлов

```
LeadStream/
├── docs/                       ← вы здесь, ТЗ
├── src/
│   ├── app/                    ← Next.js App Router
│   │   ├── page.tsx                    лендинг
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── streamer/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                кабинет стримера
│   │   │   ├── orders/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                дашборд
│   │   │   ├── streamers/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   └── payouts/page.tsx        (roadmap)
│   │   └── api/
│   │       ├── orders/route.ts
│   │       ├── streamers/route.ts
│   │       ├── stats/route.ts
│   │       └── export/route.ts
│   ├── components/
│   │   ├── ui/                         shadcn-стиль
│   │   ├── landing/
│   │   ├── streamer/
│   │   ├── admin/
│   │   └── shared/
│   ├── lib/
│   │   ├── supabase/{client,server,admin}.ts
│   │   ├── validations.ts
│   │   ├── rate-limit.ts
│   │   ├── telegram.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── types/
│   │   └── database.ts                 авто-генерация из Supabase
│   └── middleware.ts                   guard /streamer и /admin
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── public/
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 🔄 Поток данных: «новый заказ»

```
Клиент кликает "Заказать"
        │
        ▼
react-hook-form валидирует через zod (на клиенте)
        │
        ▼
fetch POST /api/orders { ...data, ref: localStorage.ref }
        │
        ▼
Next.js API Route:
  1. rate-limit по IP (10 req / мин)
  2. zod валидирует тело
  3. supabase admin client ищет streamer по ref_code
  4. INSERT в orders (привязан к streamer_id)
  5. Fire-and-forget Telegram уведомление
        │
        ▼
ответ { ok: true } → toast "Спасибо!"
```

## 📡 Realtime (опционально, на роадмап)

Дашборд админа подписывается на изменения таблицы `orders`:

```ts
supabase.channel('orders')
  .on('postgres_changes', { event: 'INSERT', table: 'orders' }, payload => {
    // обновить статистику без перезагрузки
  })
  .subscribe();
```
