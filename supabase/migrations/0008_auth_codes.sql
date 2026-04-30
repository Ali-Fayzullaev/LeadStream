-- LeadStream — Step 8: Email verification codes (OTP) for self-registration.
-- Stored short-lived 6-digit codes, hashed (never store the raw code).
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.auth_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  purpose     text not null default 'register',           -- 'register' | 'reset'
  code_hash   text not null,                               -- sha256(code+email)
  attempts    int  not null default 0,
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists auth_codes_email_idx   on public.auth_codes (lower(email), purpose, created_at desc);
create index if not exists auth_codes_expires_idx on public.auth_codes (expires_at);

-- Server-only table; only service role writes/reads. Block everyone else by RLS.
alter table public.auth_codes enable row level security;
-- (no policies → no access for anon/authenticated, only service-role bypasses)
