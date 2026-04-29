-- Optional seed: a couple of demo streamers.
-- Run via: supabase db reset (after migrations)
insert into public.streamers (name, ref_code, is_active) values
  ('Alex Stream', 'alex',  true),
  ('Maria Live',  'maria', true)
on conflict (ref_code) do nothing;
