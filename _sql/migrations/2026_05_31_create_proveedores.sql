-- Migration: create proveedores table
-- Date: 2026-05-31
-- Module: M6 — Directorio / Proveedores
--
-- Crea la tabla `proveedores` siguiendo el patrón de `clientes` y `transportes`
-- (M7 Directorio). Borrado soft via `activo=false` para preservar integridad
-- referencial con futuros remitos de compra.
--
-- Campos específicos vs clientes:
--   - rubro: qué provee la empresa (texto libre para filtrar)
--   - cuit:  necesario para facturación

CREATE TABLE IF NOT EXISTS proveedores (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  nombre      text NOT NULL,
  rubro       text,
  cuit        text,
  contacto    text,
  telefono    text,
  email       text,
  direccion   text,
  localidad   text,
  provincia   text,
  notas       text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_activo      ON proveedores(activo);
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre_lower ON proveedores(lower(nombre));

COMMENT ON TABLE  proveedores       IS 'Proveedores de herramientas/materiales. Borrado soft via activo=false.';
COMMENT ON COLUMN proveedores.rubro IS 'Qué provee: ej. "Herramientas eléctricas", "Insumos de seguridad". Texto libre.';
