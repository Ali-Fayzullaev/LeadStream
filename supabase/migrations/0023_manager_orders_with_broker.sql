-- 0023_manager_orders_with_broker.sql
-- Add broker_name to manager_orders view so managers can see which broker
-- handles each lead and filter by broker name in their dashboard.

DROP VIEW IF EXISTS public.manager_orders CASCADE;

CREATE VIEW public.manager_orders
WITH (security_invoker = on)
AS
SELECT
  o.id,
  o.created_at,
  o.updated_at,
  o.streamer_id,
  o.assigned_manager_id,
  o.assigned_broker_id,
  o.city_id,
  o.customer_name,
  o.customer_phone,
  -- masked variant for display
  CASE
    WHEN o.customer_phone IS NULL THEN NULL
    WHEN length(o.customer_phone) <= 4 THEN o.customer_phone
    ELSE substr(o.customer_phone, 1, length(o.customer_phone) - 6)
         || '****'
         || substr(o.customer_phone, length(o.customer_phone) - 1)
  END                                            AS customer_phone_masked,
  o.product_name,
  o.quantity,
  o.amount,
  o.status,
  o.ref_code_snapshot,
  s.display_name                                 AS streamer_name,
  m.display_name                                 AS manager_name,
  b.display_name                                 AS broker_name,
  c.name                                         AS city_name
FROM public.orders o
LEFT JOIN public.streamers s ON s.id = o.streamer_id
LEFT JOIN public.managers  m ON m.id = o.assigned_manager_id
LEFT JOIN public.brokers   b ON b.id = o.assigned_broker_id
LEFT JOIN public.cities    c ON c.id = o.city_id;

GRANT SELECT ON public.manager_orders TO anon, authenticated, service_role;

COMMENT ON VIEW public.manager_orders IS
  'Read model used by manager & broker dashboards. Joins streamer / manager / broker / city names with security_invoker so RLS still applies on base tables.';
