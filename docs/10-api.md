# 10 · API endpoints

Все API под `/api/*`. Внутренние Server Actions используются для форм; внешний JSON API — для аналитики и интеграций.

## Соглашения

- Формат: JSON.
- Авторизация: cookie-сессия Supabase (`@supabase/ssr`).
- Ошибки: `{ error: "Human readable" }` со статусом 4xx/5xx.
- Валидация payload: zod.
- Rate-limit на публичных эндпоинтах.

---

## Публичные

### `POST /api/orders` — создать заказ
**Auth:** не требуется
**Rate-limit:** 10 / мин / IP

```http
POST /api/orders
Content-Type: application/json

{
  "customerName": "Маша",
  "customerPhone": "+7 999 123-45-67",
  "productName": "Aurora Smart Lamp",
  "quantity": 1,
  "amount": 49.99,
  "notes": "позвоните после 18",
  "ref": "alex_2024"
}
```

**200 OK**
```json
{ "ok": true, "id": "uuid" }
```

**400** — валидация, **429** — rate-limit, **500** — ошибка БД.

Side-effects:
- INSERT в `orders` с резолвом `streamer_id` по `ref`.
- Fire-and-forget Telegram уведомление админу.

### `POST /api/auth/register-streamer` — регистрация стримера
**Auth:** не требуется
**Rate-limit:** 5 / час / IP

Проверяет уникальность `ref_code`, вызывает `supabase.auth.signUp` с метаданными `role: 'streamer'`.

---

## Стример (auth: streamer)

### `GET /api/me/orders` — мои заказы
Query: `from`, `to`, `status`, `limit`.

### `GET /api/me/stats` — моя статистика
Query: `from`, `to`.
Возвращает: orders, revenue, commission, series по дням.

### `PATCH /api/me/profile` — мой профиль
Body: `{ full_name?, tiktok_username?, phone?, avatar_url?, telegram_notifications? }`.

---

## Админ (auth: admin)

### `GET /api/streamers` — список стримеров со статистикой
Query: `status`, `q` (поиск).

### `POST /api/streamers` — создать стримера вручную
```json
{ "name": "...", "refCode": "...", "email": "...", "commissionPercent": 10 }
```

### `PATCH /api/streamers/:id` — редактировать
Поля: `display_name`, `ref_code`, `status`, `commission_percent`, `notes`.

### `DELETE /api/streamers/:id` — удалить
Заказы стримера остаются, `streamer_id = NULL`.

### `GET /api/orders` — все заказы
Query: `from`, `to`, `streamerId`, `status`, `q`, `limit`.

### `PATCH /api/orders/:id` — изменить статус
Body: `{ status: 'confirmed' }`.

### `DELETE /api/orders/:id` — удалить заказ.

### `GET /api/stats` — общие KPI
Query: `from`, `to`, `streamerId?`.
Возвращает: totalOrders, totalRevenue, streamerCount, avgOrder, series.

### `GET /api/export` — экспорт
Query: `format=xlsx|csv&from&to&streamerId?`.
Возвращает: файл Excel или CSV.

### `GET /api/payouts` — выплаты (roadmap)
### `POST /api/payouts/generate` — закрыть период (roadmap)
### `POST /api/payouts/:id/pay` — отметить выплачено (roadmap)

---

## Server Actions (внутренние)

Для форм используем Next.js Server Actions вместо REST, чтобы:
- иметь типизированный вызов из RSC,
- не дублировать валидацию,
- получить progressive enhancement.

Примеры:
- `createOrder(formData)` — публичная форма заказа.
- `createStreamer(input)` — админ создаёт стримера.
- `updateOrderStatus(id, status)` — админ меняет статус.

## Realtime (roadmap)

```ts
const channel = supabase.channel('admin-orders')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
      payload => updateDashboard(payload.new))
  .subscribe();
```

## Версионирование API

Пока MVP — без префикса. При мажорных изменениях будет `/api/v2/...`.

## Документация (roadmap)

- OpenAPI-спека через `@asteasolutions/zod-to-openapi` (генерим из zod-схем).
- Swagger UI на `/api/docs`.
