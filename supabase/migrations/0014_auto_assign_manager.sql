-- ===========================================================================
-- 0014_auto_assign_manager.sql
-- Automatic round-robin order distribution among active managers.
--
-- Когда создаётся новая заявка, выбирается активный менеджер с наименьшим
-- distribution_count и заявка автоматически назначается ему.
-- Это обеспечивает равномерное распределение: 9 заявок на 3 менеджеров → 3+3+3.
--
-- Triggered: BEFORE INSERT on public.orders (when assigned_manager_id IS NULL).
-- Side effect: increments managers.distribution_count of the chosen manager.
-- ===========================================================================

-- Helper: increment distribution counter (used by admin actions too)
create or replace function public.increment_manager_distribution(
  p_manager_id uuid,
  p_count int default 1
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.managers
     set distribution_count = coalesce(distribution_count, 0) + p_count,
         updated_at = now()
   where id = p_manager_id;
$$;

grant execute on function public.increment_manager_distribution(uuid, int) to authenticated, service_role;

-- Trigger function: auto-pick manager (round-robin by distribution_count)
create or replace function public.auto_assign_manager_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  picked uuid;
begin
  -- Skip if a manager is already assigned manually
  if new.assigned_manager_id is not null then
    return new;
  end if;

  -- Pick the active manager with the smallest distribution_count.
  -- Tie-break by oldest created_at (fair starting point) and finally by id.
  select id
    into picked
    from public.managers
   where status = 'active'
   order by coalesce(distribution_count, 0) asc,
            created_at asc,
            id asc
   limit 1;

  if picked is not null then
    new.assigned_manager_id := picked;

    -- Bump the chosen manager's counter so the next order goes to someone else
    update public.managers
       set distribution_count = coalesce(distribution_count, 0) + 1,
           updated_at = now()
     where id = picked;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_assign_manager on public.orders;
create trigger trg_auto_assign_manager
  before insert on public.orders
  for each row
  execute function public.auto_assign_manager_to_order();

-- ───────────────────────────────────────────────────────────────────────────
-- One-time backfill: distribute existing unassigned orders evenly.
-- Runs deterministically: orders without manager are sorted by created_at,
-- then assigned in round-robin fashion to currently active managers.
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  active_managers uuid[];
  n_managers int;
  unassigned_orders uuid[];
  i int;
  oid uuid;
  picked uuid;
  bump_counts jsonb := '{}';
  k text;
begin
  select coalesce(array_agg(id order by created_at, id), '{}')
    into active_managers
    from public.managers
   where status = 'active';

  n_managers := array_length(active_managers, 1);
  if n_managers is null or n_managers = 0 then
    raise notice 'No active managers — skipping backfill';
    return;
  end if;

  select coalesce(array_agg(id order by created_at, id), '{}')
    into unassigned_orders
    from public.orders
   where assigned_manager_id is null;

  if unassigned_orders is null or array_length(unassigned_orders, 1) is null then
    raise notice 'No unassigned orders — skipping backfill';
    return;
  end if;

  for i in 1..array_length(unassigned_orders, 1) loop
    oid := unassigned_orders[i];
    picked := active_managers[((i - 1) % n_managers) + 1];

    update public.orders
       set assigned_manager_id = picked,
           updated_at = now()
     where id = oid;

    -- accumulate counts for batch update
    k := picked::text;
    bump_counts := jsonb_set(
      bump_counts,
      ARRAY[k],
      to_jsonb(coalesce((bump_counts->>k)::int, 0) + 1)
    );
  end loop;

  -- apply counter bumps
  for k in select jsonb_object_keys(bump_counts) loop
    update public.managers
       set distribution_count = coalesce(distribution_count, 0) + (bump_counts->>k)::int,
           updated_at = now()
     where id = k::uuid;
  end loop;

  raise notice 'Backfilled % orders across % managers', array_length(unassigned_orders, 1), n_managers;
end $$;
