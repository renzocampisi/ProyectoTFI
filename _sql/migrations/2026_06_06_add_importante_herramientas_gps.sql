-- Migration: agregar flag `importante` a herramientas (rastreador GPS)
-- Date: 2026-06-06
--
-- Feature: "herramienta importante (lleva rastreador GPS)".
-- Las herramientas marcadas como `importante` son las que llevan un rastreador
-- GPS adjunto. Hoy se usa solo para marcado visual (badge en lista + campo en
-- detalle); a futuro habilita features de tracking en tiempo real.
--
-- Contexto: la UI ya tenía los botones "Normal" vs "⭐ Importante — lleva
-- rastreador GPS" en InventarioNewPage.jsx, pero el backend ignoraba el flag
-- silenciosamente y la columna no estaba en el schema. El usuario marcaba la
-- opción y la herramienta quedaba como Normal — bug oculto descubierto el
-- 2026-06-05.
--
-- Esta migration es idempotente y segura de re-correr. Si el environment ya
-- tenía la columna aplicada manualmente (como producción al momento del fix),
-- el ALTER no hace nada y el CREATE VIEW deja la vista consistente.
--
-- Vistas afectadas:
--   - herramientas_completas (se dropea y recrea con la columna nueva)
-- Tablas afectadas:
--   - herramientas (agrega columna)
-- RPCs afectadas: ninguna.

ALTER TABLE herramientas
  ADD COLUMN IF NOT EXISTS importante BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN herramientas.importante IS
  'Marca la herramienta como importante (lleva rastreador GPS). Default false.';

-- La vista herramientas_completas es la que usan TODOS los reads de M2
-- (getAll, getById en herramientas.service.js). Tiene que exponer la columna
-- nueva para que el frontend pueda leerla sin tocar el backend.
DROP VIEW IF EXISTS herramientas_completas;

CREATE VIEW herramientas_completas AS
SELECT
  h.id,
  h.nombre,
  h.marca,
  h.modelo,
  h.numero_serie,
  h.descripcion,
  h.anio_compra,
  h.valor,
  h.divisa,
  h.estado,
  h.codigo_qr,
  h.importante,
  h.activo,
  h.fecha_baja,
  h.motivo_baja,
  h.fecha_eliminacion,
  h.created_at,
  h.updated_at,
  h.categoria_id,
  c.nombre AS categoria_nombre
FROM herramientas h
JOIN categorias c ON c.id = h.categoria_id;
