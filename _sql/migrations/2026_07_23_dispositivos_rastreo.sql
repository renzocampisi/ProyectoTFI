-- Migration: 2026-07-23 — Dominio de dispositivos de rastreo GPS
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration
-- "dispositivos_rastreo"). Se versiona acá para historial.
--
-- Un dispositivo de rastreo (GPS) está emparejado a lo sumo a UNA
-- herramienta a la vez. `codigo_qr` es el QR propio impreso por
-- FieldStock (no el código de fábrica del proveedor). Ver
-- fieldstock-backend/src/services/dispositivos.service.js.
--
-- NOTA (agregado 2026-07-24, ver 2026_07_24_fix_rls_tablas_panel_central.sql):
-- esta tabla se creó sin RLS habilitado — bug de seguridad corregido al
-- día siguiente. Si se recrea esta tabla desde cero, activar RLS de
-- entrada.

create table dispositivos_rastreo (
  id             uuid primary key default gen_random_uuid(),
  codigo_qr      text not null unique,
  imei_proveedor text,
  herramienta_id uuid references herramientas(id) on delete set null,
  estado         text not null default 'LIBRE' check (estado = any (array['LIBRE','EMPAREJADO','BAJA'])),
  ultima_lat     numeric,
  ultima_lng     numeric,
  ultima_bateria int,
  ultima_lectura_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table dispositivos_rastreo
  add constraint dispositivos_rastreo_herramienta_check
  check (
    (estado = 'EMPAREJADO' and herramienta_id is not null) or
    (estado != 'EMPAREJADO')
  );

create index idx_dispositivos_rastreo_herramienta on dispositivos_rastreo(herramienta_id);
