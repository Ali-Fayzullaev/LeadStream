-- LeadStream — Step 3: App settings (site name + logo)
-- Singleton row 'global' that stores branding configuration editable by admins.
-- ---------------------------------------------------------------------------

create table if not exists public.app_settings (
  id          text primary key,
  site_name   text not null default 'LeadStream',
  logo_url    text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (id, site_name)
values ('global', 'LeadStream')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings read"  on public.app_settings;
drop policy if exists "app_settings admin" on public.app_settings;

-- Anyone can read branding (logo, site name shown publicly).
create policy "app_settings read"  on public.app_settings
  for select using (true);

create policy "app_settings admin" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Public storage bucket for branding (logo files).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Anyone can read branding files; only admins can upload/replace/delete.
drop policy if exists "branding read"   on storage.objects;
drop policy if exists "branding admin"  on storage.objects;

create policy "branding read" on storage.objects
  for select using (bucket_id = 'branding');

create policy "branding admin" on storage.objects
  for all using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());
