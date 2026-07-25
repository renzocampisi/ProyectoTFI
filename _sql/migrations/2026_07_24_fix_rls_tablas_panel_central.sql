-- Migration: 2026-07-24 — CRÍTICO: activar RLS en las tablas del panel central
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration
-- "fix_rls_tablas_panel_central"). Se versiona acá para historial.
--
-- Encontrado en code review (agente de revisión, mismo día): las tres
-- tablas nuevas del panel multi-cliente (2026_07_23_dispositivos_rastreo.sql
-- y 2026_07_23_panel_central_multi_cliente.sql) se crearon SIN RLS
-- habilitado. Sin eso, cualquiera con la anon key pública (embebida en el
-- bundle del frontend) podía leerlas/escribirlas directo vía el REST de
-- Supabase, sin pasar por requireAuth/requireRole/requireClaveCliente —
-- filtrando en particular la client_key de cada cliente reportado, que
-- el código del backend asume que "nunca sale hacia el frontend".
--
-- Ninguna de las tres la toca el frontend directo (solo el backend con
-- la service key, que bypassa RLS de por sí) — mismo patrón que
-- `suscripcion`, que ya tenía RLS activado sin ninguna policy (deny-all
-- para anon/authenticated).
--
-- Este mismo tipo de bug (RLS deshabilitado en tablas nuevas) ya había
-- pasado antes, ver 2026_06_15_presupuestos_rls_y_rpc.sql — dejar como
-- checklist para toda migración futura que cree una tabla nueva: activar
-- RLS SIEMPRE, incluso si "nadie la va a leer desde el frontend".

alter table instancia_central     enable row level security;
alter table clientes_reportados   enable row level security;
alter table dispositivos_rastreo  enable row level security;
