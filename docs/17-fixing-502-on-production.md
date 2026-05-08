# Чек-лист: «502 Bad Gateway» на проде (`stream.comfort-time.kz`)

> **TL;DR**  
> На странице 502 отвечает **nginx**, а не Next.js.  
> Это значит — Node-процесс либо **упал**, либо **не уложился в таймаут**, либо
> **HTTP-заголовки не уместились в буфер nginx**. Все три причины устраняются
> ниже за 5 минут.

---

## 1. nginx: дай нормальные буферы для cookie

Supabase auth-cookie выглядит так:

```
sb-zcioapfcwrecmxalpdgu-auth-token
base64-eyJh…   (≈4–6 КБ)
```

По дефолту в `/etc/nginx/nginx.conf` стоит:

```
large_client_header_buffers 4 8k;
```

При 4 КБ cookie + остальные хидеры запрос **не помещается**, nginx обрывает
бэкенд, отдаёт 502.

**Фикс.** В блок `server { ... }` (или глобально в `http { ... }`):

```nginx
server {
    listen 443 ssl http2;
    server_name stream.comfort-time.kz;

    # === КРИТИЧНО для длинных Supabase-cookie ===
    large_client_header_buffers 8 32k;
    client_header_buffer_size   16k;
    client_max_body_size        20m;

    # === Тайм-ауты до Next.js (PM2 на :3000) ===
    proxy_connect_timeout 60s;
    proxy_send_timeout    300s;
    proxy_read_timeout    300s;

    # === Передача всех заголовков ===
    proxy_buffer_size        128k;
    proxy_buffers            4 256k;
    proxy_busy_buffers_size  256k;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Применить:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. PM2: рестарт + лог

```bash
pm2 list
pm2 logs leadstream --lines 200    # ищем "Error" / "Out of memory"
pm2 restart leadstream --update-env
pm2 save
```

Если в логах видно `JavaScript heap out of memory`:

```bash
pm2 delete leadstream
NODE_OPTIONS="--max-old-space-size=1024" pm2 start npm --name leadstream -- start
pm2 save
```

---

## 3. Supabase Dashboard → Authentication → Sessions

Открой **https://supabase.com/dashboard/project/zcioapfcwrecmxalpdgu/settings/auth**:

| Параметр | Значение | Зачем |
|---|---|---|
| **JWT expiry** (`JWT_EXP`) | `86400` (24 ч) | реже принудительный refresh |
| **Refresh token rotation** | ✅ Enabled | стандарт |
| **Refresh token reuse interval** | `10` сек | grace period для гонок |
| **Inactivity timeout** | пусто или `0` | сессия не умирает «по бездействию» |
| **Time-box session** | пусто или `31536000` (1 год) | максимальный срок сессии |

После сохранения — **существующие токены** продолжают жить, новые получают
больший срок действия.

---

## 4. Что уже сделано в коде

Эти правки **гарантируют, что Node-процесс никогда не падает** даже если
refresh-token битый:

- **`src/instrumentation.ts` + `next.config.mjs` (instrumentationHook: true)**
  — глобальные `unhandledRejection` / `uncaughtException` ставятся
  **до любого пользовательского кода**, на самом старте Node-процесса.
  Подавляют `AuthApiError: Invalid Refresh Token` (фоновый таймер
  GoTrueClient), которые раньше убивали процесс → PM2 рестартил → nginx
  отдавал 502. **Это и есть главный фикс.**
- **`src/middleware.ts`** — обёрнут в top-level `try/catch`, плюс серверный
  Supabase-клиент создаётся с `autoRefreshToken: false / persistSession:
  false / detectSessionInUrl: false`. Никаких фоновых таймеров на сервере
  → unhandledRejection физически негде возникнуть.
- **`src/lib/supabase/server.ts`** — то же самое + `getUser()` /
  `getSession()` пропатчены и НЕ бросают на «Invalid Refresh Token»
  (возвращают `null`). На стейл-токене ещё и сами чистят cookie.
- **`src/lib/supabase/client.ts`** — в браузере наоборот включены
  `persistSession: true`, `autoRefreshToken: true` + длинные cookie
  (`maxAge` = 1 год), чтобы сессия выживала закрытие вкладки.
- **`src/lib/process-handlers.ts`** — дублирующий слой защиты на случай
  если по какой-то причине `instrumentation.ts` не запустился.
- **`src/components/auth-heartbeat.tsx`** — каждые 15 минут проактивно
  обновляет токен в браузере, чтобы вкладка, открытая на ночь, не
  «протухала».
- **`src/components/auth-watchdog.tsx`** — пингует `/api/_health/auth`, и
  если сервер видит мёртвую сессию, чистит cookie на клиенте.

### ⚠️ Деплой

После `git pull` на сервере **обязательно**:

```bash
cd /var/www/stream.raycon.kz
git pull
npm ci --production=false
npm run build
pm2 restart leadstream --update-env
pm2 logs leadstream --lines 50    # должна появиться строка
                                   # "[instrumentation] global error handlers installed"
```

Если в логах **нет** строки `[instrumentation] global error handlers
installed` — значит билд не подхватил `instrumentationHook`. Удали
`.next/` и пересобери: `rm -rf .next && npm run build`.

---

## 5. Алгоритм диагностики, если 502 всё-таки появился

```bash
# 1. Это nginx или Next?
curl -i http://127.0.0.1:3000/        # напрямую в Node
# Если 200 → 502 даёт nginx (буферы).
# Если ECONNREFUSED → Node лёг.

# 2. Логи Node
pm2 logs leadstream --lines 500

# 3. Логи nginx
sudo tail -n 200 /var/log/nginx/error.log
# Часто видно:    upstream prematurely closed connection
#               or: upstream sent too big header

# 4. Размер cookie
curl -s -o /dev/null -D - https://stream.comfort-time.kz/ -H "cookie: $(cat cookie.txt)" | wc -c
```

Если в `error.log` видишь `upstream sent too big header` → это **п. 1**
(буферы nginx).

Если `upstream prematurely closed connection` → **п. 2** (Node упал, см.
PM2 logs).

---

## 6. Почему `tobaccotrade.kz` не падает

Скорее всего, либо:
- авторизованных пользователей **меньше** → реже срабатывает refresh,
- nginx настроен с большими буферами по умолчанию,
- Next.js там в Docker с health-check + auto-restart,
- меньшее кол-во cookie на домене (нет ref/utm-cookies, как у нас).

После применения шагов 1–3 наша конфигурация сравняется с ней по
надёжности.
