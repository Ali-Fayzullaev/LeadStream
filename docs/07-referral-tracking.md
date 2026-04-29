# 07 · Реферальное отслеживание (атрибуция)

Сердце платформы — корректно связать клиента со стримером.

## 🧩 Идея

Каждый стример в кабинете видит свою ссылку:
```
https://yourshop.com/?ref=alex_2024
```
Стример вставляет её в TikTok-bio.

## 🔁 Жизненный цикл `ref`

### 1. Первый визит (по реф-ссылке)
```
URL: site.com/?ref=alex_2024
```
- React-компонент `<RefTracker />` (Client Component) читает `?ref=` через `useSearchParams`.
- Очищает значение (trim + макс. 64 символа + alphanumeric/подчёркивание/дефис).
- Сохраняет в:
  - `localStorage.setItem('leadstream_ref', 'alex_2024')`
  - `cookie 'leadstream_ref' (expires=30d, sameSite=Lax)`
- (Опционально) сохраняет `?utm_source / medium / campaign / content`.

### 2. Повторный визит без `?ref=`
- `<RefTracker />` ничего не делает.
- Существующий ref в localStorage остаётся.

### 3. Повторный визит с **другим** `?ref=`
**Стратегия last-touch (по умолчанию):** перезаписываем — новый стример важнее.
Альтернатива: first-touch (не перезаписывать). В админке можно сделать переключатель.

### 4. Отправка заказа
- Форма читает `getStoredRef()` → подставляет в payload.
- Если ref пустой / не существует в БД → заказ записывается **без** привязки (streamer_id = NULL).

## 🛡 Защита от подмены и фрода

| Угроза | Митигация |
|---|---|
| Стример сам делает заказы со своей ссылки | Антифрод-флаги: одинаковый IP/телефон в нескольких заказах за стримером → пометить для ручной проверки |
| Подбор чужого `ref_code` | `ref_code` короткие — не критично; проверяем `is_active=true` при резолве |
| XSS через `?ref=` | strict regex `^[a-z0-9_-]{1,64}$i`, escape при отображении |
| Боты с массовыми заказами | rate-limit + honeypot + (на роадмап) reCAPTCHA |

## 🔧 Серверный резолв `ref → streamer_id`

```ts
// в /api/orders POST handler
const { data: streamer } = await admin
  .from('streamers')
  .select('id, display_name, ref_code')
  .ilike('ref_code', ref)        // case-insensitive
  .eq('status', 'active')
  .maybeSingle();

const streamerId = streamer?.id ?? null;

await admin.from('orders').insert({
  ...orderData,
  streamer_id: streamerId,
  ref_code_snapshot: ref,        // сохраняем оригинал даже если стример позже удалён
});
```

## 🧪 Тест-кейсы

| # | Сценарий | Ожидание |
|---|---|---|
| 1 | Прямой заход + заказ | streamer_id = NULL |
| 2 | `?ref=alex` + заказ через 5 минут | streamer_id = id Алекса |
| 3 | `?ref=alex` → закрыл вкладку → зашёл через неделю → заказ | streamer_id = id Алекса (cookie ещё жив) |
| 4 | `?ref=alex` → через 31 день заказ | streamer_id = NULL (cookie истёк) |
| 5 | `?ref=alex` → `?ref=maria` → заказ | streamer_id = id Марии (last-touch) |
| 6 | `?ref=hacker` (не существует) | streamer_id = NULL, ref_code_snapshot = "hacker" |
| 7 | `?ref=<script>` | очищается regex-ом, сохраняется как пустая строка или валидная часть |

## 🔮 Расширения (на роадмап)

- **Серверная attribute-cookie** (httpOnly) — нельзя стереть из JS.
- **Click-логи** — отдельная таблица `clicks` для воронки click→order.
- **Multi-touch attribution** — учитывать всех стримеров в цепочке (first/last/linear).
- **TikTok Pixel / Conversion API** — отправка событий обратно в TikTok для оптимизации рекламы.
- **QR-код** в кабинете стримера — чтобы можно было показать на стриме (`qrcode.react`).
