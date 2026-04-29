# 14 · Деплой

Два варианта: **Vercel + Supabase Cloud** (рекомендуется) или **Self-hosted Docker**.

## 🚀 Вариант 1: Vercel + Supabase Cloud (рекомендуется)

### Настройка Supabase Cloud
1. supabase.com → New Project (бесплатный тариф).
2. Скопировать `Project URL`, `anon key`, `service_role key`.
3. Применить миграции:
   ```bash
   supabase login
   supabase link --project-ref <ref>
   supabase db push
   ```
4. (Опционально) seed: SQL Editor → выполнить `supabase/seed.sql`.
5. Создать первого админа:
   - Authentication → Users → Add user (email confirmed = true).
   - SQL Editor: `update profiles set role='admin' where email='admin@you.com';`.

### Настройка Vercel
1. Подключить GitHub-репозиторий → Import.
2. Framework: Next.js (определится автоматически).
3. Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL=https://yourshop.com
   TELEGRAM_BOT_TOKEN
   TELEGRAM_CHAT_ID
   ```
4. Deploy → Production.
5. Привязать кастомный домен → Vercel автоматически выпустит SSL.

### Настройка Supabase Auth для прода
- Authentication → URL Configuration:
  - Site URL: `https://yourshop.com`
  - Redirect URLs: `https://yourshop.com/**`
- Authentication → Providers → Email:
  - Confirm email: ON (для стримеров)
- Authentication → Email Templates: кастомизировать письма.

### CI/CD
Vercel ловит каждый push в `main` → автодеплой.
Pull requests → preview deploys (полезно для UI-ревью).

GitHub Actions (на роадмап):
- `npm run lint` + `npm run typecheck` на PR.
- E2E тесты Playwright перед merge.

## 🐳 Вариант 2: Self-hosted (Docker)

Подходит если: хотите всё своё, нет доверия к облачным БД, или клиенты в РФ.

### Структура
```yml
# docker-compose.yml
services:
  app:        # Next.js
  db:         # Postgres 16 (миграции из supabase/migrations/)
  backup:     # ежедневные pg_dump | gzip → ./backups
```

### Запуск
```bash
cp .env.example .env
# отредактировать DATABASE_URL и т.д.
docker compose up -d --build
```

### Backups
- `./backups/leadstream-YYYY-MM-DD_HHMM.sql.gz`
- Хранятся последние 14 дней.
- (на прод) дополнительно копировать в S3 / Backblaze B2 раз в день.

### Restore
```bash
gunzip -c backups/leadstream-2026-01-15_0300.sql.gz \
  | docker exec -i leadstream-db psql -U leadstream leadstream
```

### TLS
- Перед app поставить **Caddy** (автоматический Let's Encrypt) или **Traefik**.
- Пример caddyfile:
  ```
  yourshop.com {
    reverse_proxy app:3000
  }
  ```

### Минимальные ресурсы
- 1 CPU, 1 GB RAM, 20 GB SSD — достаточно для тысяч заказов в сутки.

## 🌍 Миграции БД

```bash
# Локально создать новую миграцию
supabase migration new add_payouts_table

# Применить локально
supabase db reset

# Залить в облако
supabase db push
```

Никогда не править существующие миграции — только новыми файлами.

## 🔐 Секреты

- Никогда не коммитить `.env`.
- На Vercel — через UI / `vercel env`.
- На self-hosted — `docker secrets` или `.env` с `chmod 600`.
- При утечке `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API → Reset service role key.

## 📈 Мониторинг

| Что | Где |
|---|---|
| Аптайм | Vercel Analytics, Supabase health |
| Ошибки в рантайме | Vercel logs, (roadmap) Sentry |
| SQL-ошибки | Supabase logs |
| Метрики БД | Supabase Reports |
| Внешний uptime | UptimeRobot (бесплатно) |

## 💵 Прайсинг масштабирования

| Объём | Vercel | Supabase | Итого/мес |
|---|---|---|---|
| Старт (≤500 заказов/мес) | Hobby $0 | Free $0 | **$0** |
| Рост (≤10k заказов/мес) | Pro $20 | Pro $25 | **$45** |
| Масштаб (≤100k) | Pro $20 | Team $599 | **$619** |

Self-hosted — VPS $5–20/мес независимо от объёма (но требует поддержки).

## ✅ Чеклист перед публичным запуском

- [ ] Все env-переменные на проде заполнены
- [ ] Кастомный домен подключён + SSL активен
- [ ] Supabase Site URL и Redirect URLs обновлены
- [ ] Создан первый админ
- [ ] Telegram бот работает (тестовый заказ)
- [ ] Бэкапы настроены и проверены (тест восстановления!)
- [ ] favicon, og-image, sitemap, robots.txt
- [ ] Lighthouse ≥ 90 на main URL
- [ ] Политика конфиденциальности и оферта на сайте (если ИП/ООО)
- [ ] (roadmap) Sentry, аналитика, мониторинг
