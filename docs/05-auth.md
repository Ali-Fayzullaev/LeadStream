# 05 · Авторизация

Используем **Supabase Auth** (email + пароль).

## 🚪 Маршруты входа

| URL | Кто |
|---|---|
| `/streamer/register` | стример регистрируется сам |
| `/login` | стример входит |
| `/admin/login` | админ входит (регистрация — только вручную) |

## 🎬 Регистрация стримера

### Поля формы
- ФИО (`full_name`)
- @ник в TikTok (`tiktok_username`)
- Email
- Пароль (минимум 8 символов, 1 цифра)
- Желаемый `ref_code` (a-z, 0-9, дефис; 3–32 символа). Если занят — система предложит варианты.
- Согласие на обработку данных (checkbox)

### Логика
1. Клиент валидирует форму через zod.
2. POST `/api/auth/register-streamer`:
   - Сервер проверяет уникальность `ref_code`.
   - Вызывает `supabase.auth.signUp({ email, password, options: { data: { full_name, role: 'streamer', tiktok_username, desired_ref_code } } })`.
   - Триггер `handle_new_user` создаёт `profiles` (role=streamer) и `streamers` (status=pending).
3. Supabase отправляет письмо подтверждения email.
4. После подтверждения — стример может войти, но видит экран **«Аккаунт на модерации»** пока админ не одобрит.
5. Админ заходит в `/admin/streamers`, видит pending-аккаунт, нажимает **«Одобрить»** → `status = active`.
6. Стример получает email-уведомление об одобрении и доступ к кабинету.

### Защита от спама
- reCAPTCHA v3 (опционально на роадмап) или honeypot-поле.
- Rate-limit `/api/auth/register-streamer`: 5 регистраций/час с одного IP.

## 🔑 Вход (стример и админ — одна логика)

1. Email + пароль → `supabase.auth.signInWithPassword(...)`.
2. Supabase ставит httpOnly cookie с JWT.
3. `middleware.ts` на каждом запросе:
   - Достаёт сессию через `@supabase/ssr`.
   - Проверяет, что юзер залогинен на защищённых маршрутах.
   - Проверяет роль: `/admin/*` → только `role=admin`; `/streamer/*` → только `role=streamer`.
4. Редиректит на нужный кабинет в зависимости от роли.

## 🛡 Создание первого админа

Регистрация админа через UI **отключена**. Создаётся одним из способов:

### Способ 1 — через Supabase Dashboard
1. Authentication → Users → **Add user** (email + пароль, email confirmed).
2. SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'admin@yourcompany.com';
   ```

### Способ 2 — миграция
```sql
-- В одной из миграций / seed.sql
insert into profiles (id, email, role, full_name)
values ('<id-из-auth.users>', 'admin@...', 'admin', 'Owner');
```

## 🔄 Восстановление пароля

- На `/login` ссылка «Забыли пароль?»
- POST `/api/auth/forgot-password` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/reset' })`.
- Пользователь получает письмо со ссылкой → попадает на `/auth/reset` → вводит новый пароль → `supabase.auth.updateUser({ password })`.

## 🔐 Безопасность

- Пароль никогда не уходит на сервер в открытом виде — supabase-js использует HTTPS.
- Хэширование паролей делает Supabase (bcrypt).
- JWT короткоживущий (1 час) + refresh token (7 дней).
- httpOnly cookies — защита от XSS.
- SameSite=Lax — защита от CSRF.

## ❓ Что не делаем в MVP (но легко добавить)

- Соц-логин (Google, TikTok OAuth) — `supabase.auth.signInWithOAuth(...)`.
- 2FA — Supabase поддерживает TOTP.
- Magic link вход — `signInWithOtp(...)`.
- SSO для команды админов.
