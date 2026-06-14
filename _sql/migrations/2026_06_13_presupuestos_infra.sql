-- Migration: 2026-06-13 — Presupuestos (parte 1/6 de la feature)
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration "presupuestos_infra").
-- Se versiona aca para historial del repo.
--
-- Setup completo de infra para la feature Presupuestos. Backend y frontend
-- vienen en partes 2-6.
--
-- Decisiones tomadas (ver discusion en chat):
-- - El % de ganancia aplica SOLO al subtotal_insumos (markup de reventa).
--   Los costos extra (mano de obra, viaticos, etc.) se trasladan tal cual.
--   total = subtotal_insumos * (1 + pct/100) + subtotal_costos
-- - Sin reserva de stock al aprobar: el stock se descuenta solo al confirmar
--   el remito generado (decision #2 del diseno).
-- - Categorias de costos opcionales: cada presupuesto decide cuales aplica.
-- - Multiples presupuestos por obra (versiones): cada APROBADO genera su
--   propio remito BORRADOR.
-- - PDF privado en bucket dedicado, mismo patron que comprobantes-compras.

-- ── Ampliar estados de obras ─────────────────────────────────
-- Default sigue ACTIVA para no romper el flujo viejo de crear obras
-- directas. El frontend nuevo seteara PENDIENTE_PRESUPUESTO explicito
-- cuando arranca desde el flujo de presupuestos.
ALTER TABLE obras DROP CONSTRAINT IF EXISTS obras_estado_check;
ALTER TABLE obras ADD CONSTRAINT obras_estado_check
  CHECK (estado IN ('PENDIENTE_PRESUPUESTO', 'EN_APROBACION', 'ACTIVA', 'FINALIZADA', 'RECHAZADA'));

-- ── Tabla key/value de configuracion del sistema ─────────────
-- Por ahora solo usamos `porcentaje_ganancia_default`. Deja la puerta
-- abierta a otros settings sin necesitar migrations nuevas.
CREATE TABLE IF NOT EXISTS config_sistema (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO config_sistema (key, value) VALUES ('porcentaje_ganancia_default', '10')
ON CONFLICT (key) DO NOTHING;

-- ── Secuencia + RPC para numerar presupuestos (PR-NNNNN) ─────
CREATE SEQUENCE IF NOT EXISTS seq_presupuesto START 1;

CREATE OR REPLACE FUNCTION generar_numero_presupuesto()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'PR-' || LPAD(nextval('seq_presupuesto')::text, 5, '0');
END;
$$;

-- ── Tabla principal: presupuestos ────────────────────────────
CREATE TABLE IF NOT EXISTS presupuestos (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero                text NOT NULL UNIQUE,
  obra_id               uuid NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  estado                text NOT NULL DEFAULT 'BORRADOR'
                        CHECK (estado IN ('BORRADOR', 'EN_APROBACION', 'APROBADO', 'RECHAZADO')),
  porcentaje_ganancia   numeric(5, 2) NOT NULL DEFAULT 10,
  subtotal_insumos      numeric(12, 2) NOT NULL DEFAULT 0,
  subtotal_costos       numeric(12, 2) NOT NULL DEFAULT 0,
  total                 numeric(12, 2) NOT NULL DEFAULT 0,
  observaciones         text,
  pdf_url               text,
  fecha_creacion        timestamptz DEFAULT now(),
  fecha_envio           timestamptz,
  fecha_aprobacion      timestamptz,
  aprobado_por          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo_rechazo        text,
  remito_generado_id    uuid REFERENCES remitos(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_obra ON presupuestos(obra_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON presupuestos(estado);

-- ── Items: insumos cotizados (materiales) ────────────────────
CREATE TABLE IF NOT EXISTS presupuesto_insumos (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  presupuesto_id    uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  material_id       uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  cantidad          numeric(10, 2) NOT NULL CHECK (cantidad > 0),
  precio_unitario   numeric(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal          numeric(12, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_insumos_presupuesto ON presupuesto_insumos(presupuesto_id);

-- ── Items: costos extra (mano de obra, viaticos, seguros, etc.) ──
CREATE TABLE IF NOT EXISTS presupuesto_costos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  presupuesto_id  uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  categoria       text NOT NULL
                  CHECK (categoria IN ('MANO_OBRA', 'VIATICOS', 'SEGUROS', 'PERSONAL_EXTRA', 'OTROS')),
  descripcion     text NOT NULL,
  cantidad        numeric(10, 2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  unidad          text,  -- 'horas', 'km', 'dias', 'global', etc. — libre
  costo_unitario  numeric(10, 2) NOT NULL CHECK (costo_unitario >= 0),
  subtotal        numeric(12, 2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_costos_presupuesto ON presupuesto_costos(presupuesto_id);

-- ── Trigger: recalcular subtotales/total al cambiar items ────
CREATE OR REPLACE FUNCTION recalc_presupuesto_totales()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_presupuesto_id  uuid;
  v_sub_insumos     numeric(12, 2);
  v_sub_costos      numeric(12, 2);
  v_pct_ganancia    numeric(5, 2);
BEGIN
  v_presupuesto_id := COALESCE(NEW.presupuesto_id, OLD.presupuesto_id);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_sub_insumos
    FROM presupuesto_insumos WHERE presupuesto_id = v_presupuesto_id;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_sub_costos
    FROM presupuesto_costos WHERE presupuesto_id = v_presupuesto_id;

  SELECT porcentaje_ganancia INTO v_pct_ganancia
    FROM presupuestos WHERE id = v_presupuesto_id;

  UPDATE presupuestos SET
    subtotal_insumos = v_sub_insumos,
    subtotal_costos  = v_sub_costos,
    total            = ROUND(v_sub_insumos * (1 + v_pct_ganancia/100) + v_sub_costos, 2),
    updated_at       = now()
  WHERE id = v_presupuesto_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_pres_insumos ON presupuesto_insumos;
CREATE TRIGGER trg_recalc_pres_insumos
  AFTER INSERT OR UPDATE OR DELETE ON presupuesto_insumos
  FOR EACH ROW EXECUTE FUNCTION recalc_presupuesto_totales();

DROP TRIGGER IF EXISTS trg_recalc_pres_costos ON presupuesto_costos;
CREATE TRIGGER trg_recalc_pres_costos
  AFTER INSERT OR UPDATE OR DELETE ON presupuesto_costos
  FOR EACH ROW EXECUTE FUNCTION recalc_presupuesto_totales();

-- ── Trigger: recalcular total cuando se edita el % ganancia ──
CREATE OR REPLACE FUNCTION recalc_presupuesto_por_ganancia()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.porcentaje_ganancia IS DISTINCT FROM OLD.porcentaje_ganancia THEN
    NEW.total := ROUND(NEW.subtotal_insumos * (1 + NEW.porcentaje_ganancia/100) + NEW.subtotal_costos, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_pres_ganancia ON presupuestos;
CREATE TRIGGER trg_recalc_pres_ganancia
  BEFORE UPDATE OF porcentaje_ganancia ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION recalc_presupuesto_por_ganancia();

-- ── Bucket privado para PDFs de presupuestos ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'presupuestos-pdf',
  'presupuestos-pdf',
  false,
  5242880,  -- 5 MiB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;
