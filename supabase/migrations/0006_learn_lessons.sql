-- LeadStream — Step 6: Admin-managed training (learn) content
-- Admin creates/edits/removes lessons; streamers read.
-- ---------------------------------------------------------------------------

create table if not exists public.learn_lessons (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  youtube_url  text,
  body         text,                       -- optional rich body (markdown / plain)
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists learn_lessons_sort_idx on public.learn_lessons (sort_order, created_at);
create index if not exists learn_lessons_pub_idx  on public.learn_lessons (is_published);

alter table public.learn_lessons enable row level security;

drop policy if exists "learn_lessons read auth"   on public.learn_lessons;
drop policy if exists "learn_lessons admin all"   on public.learn_lessons;

-- Any authenticated user (streamer or admin) can read published lessons.
create policy "learn_lessons read auth" on public.learn_lessons
  for select to authenticated
  using (is_published or public.is_admin());

-- Admin full access.
create policy "learn_lessons admin all" on public.learn_lessons
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_learn_lessons_updated_at on public.learn_lessons;
create trigger set_learn_lessons_updated_at before update on public.learn_lessons
  for each row execute function public.set_updated_at();
