-- Fix de 4 findings del Security Advisor de Supabase (nivel ERROR):
--   1. auth_users_exposed: usuarios_resumen expone auth.users al rol anon
--   2-4. security_definer_view: herramientas_completas, remito_items_completo
--        y usuarios_resumen corren como SECURITY DEFINER (default de Postgres
--        si no se especifica lo contrario), bypasseando RLS para quien consulte.
--
-- Contexto: el frontend nunca consulta estas vistas directo (solo Auth vía
-- anon key); todo el acceso a datos pasa por el backend con
-- SUPABASE_SERVICE_KEY, que bypassea RLS y grants igual. Este fix no afecta
-- al backend.

-- 1) SECURITY INVOKER: las vistas pasan a correr con los privilegios de quien
--    consulta (comportamiento estándar recomendado por Supabase, requiere PG 15+)
ALTER VIEW public.herramientas_completas SET (security_invoker = on);
ALTER VIEW public.remito_items_completo SET (security_invoker = on);
ALTER VIEW public.usuarios_resumen SET (security_invoker = on);

-- 2) Revocar acceso de anon/authenticated a usuarios_resumen (expone auth.users.email)
--    service_role no depende de estos grants, así que el backend sigue funcionando.
REVOKE SELECT ON public.usuarios_resumen FROM anon, authenticated;
