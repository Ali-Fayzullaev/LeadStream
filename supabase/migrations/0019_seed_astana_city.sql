-- ===========================================================================
-- 0019_seed_astana_city.sql
-- Add default city: Астана
-- ===========================================================================

INSERT INTO public.cities (name, is_active)
VALUES ('Астана', true)
ON CONFLICT DO NOTHING;
