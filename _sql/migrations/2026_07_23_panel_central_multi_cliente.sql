-- Migration: 2026-07-23 — Identidad de máquina para el panel central multi-cliente
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration
-- "panel_central_multi_cliente"). Se versiona acá para historial.
--
-- Ver architecture-multi-cliente.html / implementation-multi-cliente.html
-- (generados en la sesión, no versionados en el repo) para el diseño
-- completo. Resumen: cada instancia-cliente genera su propia client_key
-- (instancia_central) y la usa para reportarse a la instancia central,
-- que guarda el último estado de cada cliente en clientes_reportados.
--
-- NOTA (agregado 2026-07-24, ver 2026_07_24_fix_rls_tablas_panel_central.sql):
-- ambas tablas se crearon sin RLS habilitado — bug de seguridad crítico
-- (la client_key de cada cliente quedaba legible por cualquiera con la
-- anon key pública) corregido al día siguiente. Si se recrean estas
-- tablas desde cero, activar RLS de entrada — ninguna de las dos la toca
-- el frontend directo, solo el backend con la service key.

create table instancia_central (
  id             uuid primary key default gen_random_uuid(),
  client_key     text not null unique,
  registrada_at  timestamptz,
  created_at     timestamptz not null default now()
);

create table clientes_reportados (
  id                       uuid primary key default gen_random_uuid(),
  empresa_nombre           text,
  dueño_nombre             text,
  dueño_email              text,
  url_backend              text not null,
  client_key               text not null unique,
  plan_codigo              text,
  plan_nombre              text,
  empleados_extra          int not null default 0,
  herramientas_cupo        int not null default 0,
  herramientas_emparejadas int not null default 0,
  ultimo_reporte_at        timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
