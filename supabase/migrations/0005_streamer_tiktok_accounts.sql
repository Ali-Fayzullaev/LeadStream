-- LeadStream — Step 5: Streamer TikTok accounts (multi)
-- Each streamer can attach multiple TikTok accounts (handles).
-- ---------------------------------------------------------------------------

create table if not exists public.streamer_tiktok_accounts (
  id           uuid primary key default gen_random_uuid(),
  streamer_id  uuid not null references public.streamers(id) on delete cascade,
  username     text not null,
  is_primary   boolean not null default false,
  followers    int,
  created_at   timestamptz not null default now()
);

-- Normalise usernames: store without leading '@', case-insensitive uniqueness per streamer.
create unique index if not exists streamer_tiktok_accounts_unique_username
  on public.streamer_tiktok_accounts (streamer_id, lower(username));

create index if not exists streamer_tiktok_accounts_streamer_idx
  on public.streamer_tiktok_accounts (streamer_id);

alter table public.streamer_tiktok_accounts enable row level security;

drop policy if exists "tiktok_accounts self read"   on public.streamer_tiktok_accounts;
drop policy if exists "tiktok_accounts self write"  on public.streamer_tiktok_accounts;
drop policy if exists "tiktok_accounts admin all"   on public.streamer_tiktok_accounts;

-- Streamer can read/manage their own accounts.
create policy "tiktok_accounts self read" on public.streamer_tiktok_accounts
  for select using (
    streamer_id = public.current_streamer_id()
  );

create policy "tiktok_accounts self write" on public.streamer_tiktok_accounts
  for all using (
    streamer_id = public.current_streamer_id()
  ) with check (
    streamer_id = public.current_streamer_id()
  );

-- Admin full access.
create policy "tiktok_accounts admin all" on public.streamer_tiktok_accounts
  for all using (public.is_admin()) with check (public.is_admin());

-- Backfill: copy legacy single tiktok_username into the new table as primary.
insert into public.streamer_tiktok_accounts (streamer_id, username, is_primary)
select s.id, s.tiktok_username, true
from public.streamers s
where s.tiktok_username is not null
  and length(trim(s.tiktok_username)) > 0
  and not exists (
    select 1 from public.streamer_tiktok_accounts a where a.streamer_id = s.id
  );
