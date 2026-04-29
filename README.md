# LeadStream

Modern web app to track orders coming from streamer-driven TikTok ads.
Public landing page with product + order form, admin dashboard with stats,
per-streamer attribution via `?ref=<code>` (persisted 30 days), Telegram
notifications and Excel/CSV export.

## Stack

- **Next.js 14** (App Router, Server Components) + **TypeScript** (strict)
- **Supabase** — Postgres + Auth + RLS (the entire backend)
- **TailwindCSS** + Shadcn/ui-style primitives + **Framer Motion**
- **Recharts** for charts
- **Zod** + **react-hook-form** for validation
- **xlsx** for exports
- **Telegram Bot API** for new-order alerts

## Quick start

### 1. Configure Supabase

Either use a hosted Supabase project or `supabase start` locally.

```bash
cp .env.example .env
# then fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and SUPABASE_SERVICE_ROLE_KEY from your project settings.
```

### 2. Apply the schema

```bash
# Hosted project (recommended):
#   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
#
# Or with the Supabase CLI:
supabase db push
# Optional demo data:
psql "$DATABASE_URL" -f supabase/seed.sql
```

### 3. Create the first admin

The trigger `handle_new_user` automatically promotes any new auth user to
the `admin` role. Create the user via the Supabase dashboard
(_Authentication → Add user_) **with email confirmation off**, or via the
admin API. After that, sign in at `/admin/login`.

### 4. Run

```bash
npm install
npm run dev
# → http://localhost:3000          (public)
# → http://localhost:3000/admin    (dashboard)
```

## How attribution works

1. A streamer shares a link like `https://your-site.com/?ref=alex`.
2. On first visit, `<RefTracker />` stores `alex` in **localStorage** and a
   cookie for 30 days.
3. When the visitor submits the order form, the stored `ref` is sent with
   the request and the API resolves it to a `streamers.id`.

## Telegram notifications

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`. New orders fire
a Telegram message via `sendTelegramMessage()` (fire-and-forget).

## Security

- **RLS** is enabled on every table. Public can only `INSERT` orders;
  admins (rows in `public.profiles` with `role = 'admin'`) can do
  everything.
- **Rate limiting** — `src/lib/rate-limit.ts` throttles order submissions
  to 10/min per IP.
- **Service role key** is loaded only in `src/lib/supabase/admin.ts`,
  guarded by `import 'server-only'`.

## Docker

A `docker-compose.yml` ships an app container, a Postgres container that
loads the same SQL migrations on first boot, and a sidecar that takes
**daily gzipped backups** into `./backups` (keeps last 14).

```bash
docker compose up -d --build
```

For production, point the app at hosted Supabase and you only need the
`app` service.

## Project layout

```
src/
  app/
    api/                # Route handlers (orders, streamers, stats, export)
    admin/              # Protected dashboard
    page.tsx            # Public landing
  components/           # UI primitives + RefTracker, OrderForm
  lib/
    supabase/           # client / server / admin
    validations.ts      # zod schemas
    rate-limit.ts
    telegram.ts
  middleware.ts         # Refresh session + guard /admin
supabase/
  migrations/0001_init.sql
  seed.sql
```

## Extending

- Add product CMS — create a `products` table and read it from the landing.
- Multi-tenant — add `org_id` columns and update RLS to compare against
  `auth.jwt() -> 'app_metadata' -> 'org_id'`.
- Realtime dashboard — subscribe via `supabase.channel('orders')` on
  `INSERT` events.
