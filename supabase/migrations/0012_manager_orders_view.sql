-- Сначала удаляем представление, если оно существует
drop view if exists manager_orders cascade;

-- Manager orders view: shows assigned orders with masked phone and streamer name
create view manager_orders as
select
  o.id,
  o.created_at,
  o.updated_at,
  o.customer_name,
  o.customer_phone,
  -- Mask customer phone: +7 (912) ****34 (show only last 2 digits)
  case 
    when o.customer_phone_masked is not null and o.customer_phone_masked != '' 
    then '***' || right(o.customer_phone_masked, 2)
    else '***'
  end as customer_phone_masked,
  o.amount,
  o.status,
  s.display_name as streamer_name,
  o.assigned_manager_id
from orders o
left join streamers s on o.streamer_id = s.id;

-- Включаем security_invoker для представления
alter view manager_orders set (security_invoker = on);

-- Удаляем старые политики, если они существуют
drop policy if exists "managers_see_own_assigned_orders" on orders;
drop policy if exists "admin_see_all_orders" on orders;

-- Создаем политики на БАЗОВОЙ таблице orders
-- Политика для менеджеров: видят только свои назначенные заказы
create policy "managers_see_own_assigned_orders" on orders
  for select
  using (
    assigned_manager_id = (
      select id from managers where user_id = auth.uid()
    )
  );

-- Политика для администраторов: видят все заказы
create policy "admin_see_all_orders" on orders
  for select
  using (
    exists (
      select 1 from auth.users
      where id = auth.uid() and raw_app_meta_data->>'role' = 'admin'
    )
  );