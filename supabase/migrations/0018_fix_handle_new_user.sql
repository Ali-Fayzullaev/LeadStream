-- ===========================================================================
-- 0018_fix_handle_new_user.sql
-- Fix: handle_new_user trigger now supports broker/manager roles
-- without crashing on unknown role values.
-- ===========================================================================

-- Update handle_new_user to handle broker/manager roles gracefully
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role_raw  text  := coalesce(nullif(meta->>'role', ''), 'streamer');
  v_role      public.user_role;
  v_full_name text  := nullif(meta->>'full_name', '');
  v_desired_ref text := nullif(meta->>'desired_ref_code', '');
  v_tiktok    text  := nullif(meta->>'tiktok_username', '');
  v_ref       text;
begin
  -- Map broker/manager to 'streamer' in profiles (they don't use profiles table)
  -- Only 'admin' and 'streamer' are valid enum values
  if v_role_raw = 'admin' then
    v_role := 'admin';
  else
    v_role := 'streamer';
  end if;

  -- Insert profile only for admin and streamer roles
  -- broker and manager have their own tables
  if v_role_raw not in ('broker', 'manager') then
    insert into public.profiles (id, email, role, full_name)
    values (new.id, new.email, v_role, v_full_name)
    on conflict (id) do nothing;
  end if;

  -- Create streamer row only for actual streamers
  if v_role_raw = 'streamer' then
    v_ref := public.generate_unique_ref_code(
      coalesce(v_desired_ref, v_full_name, split_part(new.email, '@', 1))
    );
    insert into public.streamers (user_id, display_name, tiktok_username, ref_code, status)
    values (
      new.id,
      coalesce(v_full_name, split_part(new.email, '@', 1)),
      v_tiktok,
      v_ref,
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
