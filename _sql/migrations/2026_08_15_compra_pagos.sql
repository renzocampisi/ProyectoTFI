-- Migration: soportar múltiples medios de pago y moneda por compra
-- Date: 2026-08-15
--
-- Feature: hoy `compras.medio_pago` es un único valor fijo por compra
-- (EFECTIVO/TRANSFERENCIA/CHEQUE/TARJETA/CUENTA_CORRIENTE) y no hay moneda.
-- El pedido es poder registrar que una compra se pagó, por ejemplo, parte en
-- efectivo + parte con cheque, o parte en ARS y parte en USD. Se modela como
-- una tabla hija `compra_pagos` — una fila por "línea de pago" (medio +
-- moneda + monto), en vez de forzar todo en una sola columna de la cabecera.
--
-- No se valida que la suma de `compra_pagos.monto` coincida con
-- `compras.total`: si hay líneas en distintas monedas, sumarlas directamente
-- no tiene sentido sin una cotización, y esa conversión no forma parte de
-- este pedido — los pagos quedan como un desglose informativo.
--
-- Tablas afectadas:
--   - compra_pagos (nueva)
--   - compras (columna `medio_pago` queda DEPRECATED, no se dropea)
-- Vistas afectadas: ninguna (compras/compras_items no tienen vista propia,
--   se leen directo desde compras.service.js).
-- RPCs afectadas: ninguna.

CREATE TABLE IF NOT EXISTS compra_pagos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id   UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  medio_pago  TEXT NOT NULL
                CHECK (medio_pago IN ('EFECTIVO','TRANSFERENCIA','CHEQUE','TARJETA','CUENTA_CORRIENTE')),
  moneda      TEXT NOT NULL DEFAULT 'ARS'
                CHECK (moneda IN ('ARS','USD')),
  monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compra_pagos_compra ON compra_pagos(compra_id);

ALTER TABLE compra_pagos ENABLE ROW LEVEL SECURITY;

-- Backfill: cada compra existente con total > 0 pasa a tener una única línea
-- de pago que replica su medio_pago actual, en ARS, por el total completo.
-- Es la mejor reconstrucción posible — no hay forma de saber retroactivamente
-- si una compra vieja se pagó en más de un medio/moneda.
INSERT INTO compra_pagos (compra_id, medio_pago, moneda, monto)
SELECT id, medio_pago, 'ARS', total
FROM compras
WHERE total > 0;

COMMENT ON COLUMN compras.medio_pago IS
  'DEPRECATED desde 2026-08-15: reemplazado por compra_pagos, que soporta múltiples medios/monedas por compra. Se conserva la columna (con su default EFECTIVO) por compatibilidad hacia atrás, pero el backend ya no la lee ni la escribe.';
