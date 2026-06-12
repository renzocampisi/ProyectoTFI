-- ============================================================
-- Módulo Compras — tablas, secuencias, triggers
-- ============================================================
-- Modela ÓRDENES DE COMPRA hacia un proveedor. Cabecera (`compras`) +
-- detalle (`compras_items`). Cada compra tiene UN proveedor y N items
-- de materiales del catálogo. El stock_actual del material se incrementa
-- cuando la compra pasa a RECIBIDA o RECIBIDA_PARCIAL (servicio del backend).
--
-- Numeración: secuencia + función al estilo de remitos (generar_numero_remito),
-- usada por el backend al insertar la cabecera. Formato: OC-NNNNN.
-- ============================================================

-- ── Secuencia + función para numerar OC-NNNNN ──────────────
CREATE SEQUENCE IF NOT EXISTS compra_numero_seq START 1;

CREATE OR REPLACE FUNCTION generar_numero_compra()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  numero TEXT;
BEGIN
  numero := LPAD(nextval('compra_numero_seq')::TEXT, 5, '0');
  RETURN 'OC-' || numero;
END;
$$;

-- ── Tabla compras (cabecera) ───────────────────────────────
CREATE TABLE IF NOT EXISTS compras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT UNIQUE NOT NULL,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  estado          TEXT NOT NULL DEFAULT 'BORRADOR'
                    CHECK (estado IN ('BORRADOR','CONFIRMADA','RECIBIDA_PARCIAL','RECIBIDA','CANCELADA')),
  fecha_pedido    TIMESTAMPTZ,
  fecha_recepcion TIMESTAMPTZ,
  medio_pago      TEXT NOT NULL DEFAULT 'EFECTIVO'
                    CHECK (medio_pago IN ('EFECTIVO','TRANSFERENCIA','CHEQUE','TARJETA','CUENTA_CORRIENTE')),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  observaciones   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Tabla compras_items (detalle) ──────────────────────────
CREATE TABLE IF NOT EXISTS compras_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id          UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  material_id        UUID NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  cantidad           NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario    NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal           NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  cantidad_recibida  NUMERIC(10,2) NOT NULL DEFAULT 0
                       CHECK (cantidad_recibida >= 0 AND cantidad_recibida <= cantidad),
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ── Índices ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_compras_proveedor      ON compras(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_estado         ON compras(estado);
CREATE INDEX IF NOT EXISTS idx_compras_items_compra   ON compras_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_items_material ON compras_items(material_id);

-- ── Trigger: recálculo automático de compras.total ─────────
-- Mantenemos `compras.total` denormalizado para que el listado lo lea
-- sin agregaciones. Cada INSERT/UPDATE/DELETE en compras_items reescribe
-- el total de la compra padre via SUM(subtotal).
CREATE OR REPLACE FUNCTION recalc_compra_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cid UUID;
BEGIN
  cid := COALESCE(NEW.compra_id, OLD.compra_id);
  UPDATE compras
     SET total      = COALESCE((SELECT SUM(subtotal) FROM compras_items WHERE compra_id = cid), 0),
         updated_at = now()
   WHERE id = cid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_items_recalc ON compras_items;
CREATE TRIGGER trg_compras_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON compras_items
FOR EACH ROW EXECUTE FUNCTION recalc_compra_total();

-- ── RLS ────────────────────────────────────────────────────
-- Habilitamos RLS por consistencia con el resto de tablas del sistema.
-- Las operaciones reales pasan por el backend con SERVICE_KEY que bypassa RLS.
-- No definimos policies para anon/authenticated (acceso solo via backend).
ALTER TABLE compras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_items ENABLE ROW LEVEL SECURITY;
