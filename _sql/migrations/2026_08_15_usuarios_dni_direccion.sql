-- Migration: agregar dni y direccion a usuarios (feature "Empleados" — botón Detalles)
-- Date: 2026-08-15
--
-- Feature: la lista de empleados (antes "Usuarios", ver AppLayout.jsx) ahora
-- muestra solo Nombre/Rol/Estado/Alta en la tabla, y agrega un botón
-- "Detalles" por fila que abre un modal con DNI, teléfono, dirección y mail.
-- DNI y dirección no existían en el schema — se agregan acá.
--
-- Ambas columnas son NULLABLE (no hay backfill posible ni sentido de default
-- para datos personales) — cambio aditivo, no destructivo, seguro de correr
-- en cualquier momento.
--
-- Tablas afectadas:
--   - usuarios (agrega 2 columnas)
--
-- Vistas afectadas:
--   - usuarios_resumen: usuarios.service.js lee vía esta vista con
--     `.select('*')` (ver getAll/getById). Postgres NO expande `*` en vistas
--     ya creadas — agregar columnas a `usuarios` no las hace aparecer solas
--     en `usuarios_resumen`. Definición real obtenida con
--     `SELECT pg_get_viewdef('usuarios_resumen'::regclass, true);` el
--     2026-08-16 (ver DROP VIEW + CREATE VIEW abajo, mismo patrón que
--     herramientas_completas en 2026_06_06_add_importante_herramientas_gps.sql).
--     Los permisos de lectura no cambian: el backend siempre consulta esta
--     vista con SUPABASE_SERVICE_KEY, que bypassa RLS/grants.
--
-- RPCs afectadas: ninguna.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS dni       TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT;

COMMENT ON COLUMN usuarios.dni       IS 'DNI del empleado (opcional). Solo visible en el modal de Detalles.';
COMMENT ON COLUMN usuarios.direccion IS 'Dirección del empleado (opcional). Solo visible en el modal de Detalles.';

DROP VIEW IF EXISTS usuarios_resumen;

CREATE VIEW usuarios_resumen AS
SELECT u.id,
    u.nombre,
    u.telefono,
    u.dni,
    u.direccion,
    u.role,
    u.activo,
    au.email,
    u.created_at,
    u.updated_at
   FROM usuarios u
     JOIN auth.users au ON au.id = u.id;
