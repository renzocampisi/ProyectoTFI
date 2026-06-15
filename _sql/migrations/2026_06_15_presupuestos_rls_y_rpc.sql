-- Migration: 2026-06-15 — Presupuestos RLS + RPC aprobar transaccional
--
-- Estado: APLICADA en remoto via Supabase MCP (apply_migration
-- "presupuestos_rls_y_rpc_aprobar"). Se versiona acá para historial.
--
-- Resuelve 3 issues críticos detectados en la auditoría post-merge:
--
--  1.1 (seguridad) — RLS deshabilitado en presupuestos / insumos /
--      costos / config_sistema. Un atacante con la anon_key del
--      frontend podría hacer queries directas saltando el backend.
--      Activamos RLS + policy "authenticated full access" (mismo
--      patrón que el resto de las tablas del sistema).
--
--  1.2 + 1.3 (transaccionalidad) — `aprobar()` ejecutaba 4 escrituras
--      sucesivas sin transacción. Si fallaba después del insert del
--      remito quedaba un remito huérfano + presupuesto inconsistente.
--      Lo reemplazamos por una RPC PL/pgSQL: si cualquier paso lanza
--      excepción, Postgres revierte todos los cambios. La RPC también
--      valida que la obra exista antes de proceder (issue 1.2).
--
-- Bonus issue 2.4: si el presupuesto no tiene insumos, la RPC no crea
-- remito (devuelve NULL en remito_generado_id) — evita remitos vacíos
-- que confunden al operador.

-- ── RLS en tablas nuevas ──────────────────────────────────────
ALTER TABLE presupuestos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_insumos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_costos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sistema        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all  ON presupuestos;
DROP POLICY IF EXISTS auth_all  ON presupuesto_insumos;
DROP POLICY IF EXISTS auth_all  ON presupuesto_costos;
DROP POLICY IF EXISTS auth_read ON config_sistema;

CREATE POLICY auth_all  ON presupuestos        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all  ON presupuesto_insumos FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all  ON presupuesto_costos  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
-- config_sistema: read-only para authenticated. Writes solo via backend.
CREATE POLICY auth_read ON config_sistema      FOR SELECT TO authenticated USING (true);

-- ── RPC aprobar_presupuesto (transaccional) ───────────────────
CREATE OR REPLACE FUNCTION aprobar_presupuesto(
  p_id      uuid,
  p_user_id uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_presupuesto    presupuestos%ROWTYPE;
  v_obra           obras%ROWTYPE;
  v_remito_id      uuid := NULL;
  v_numero_remito  text;
  v_count_insumos  integer;
BEGIN
  -- Lock + leer presupuesto
  SELECT * INTO v_presupuesto FROM presupuestos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_presupuesto.estado != 'EN_APROBACION' THEN
    RAISE EXCEPTION 'Solo EN_APROBACION puede aprobarse (estado actual: %)', v_presupuesto.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- Validar que la obra existe (issue 1.2)
  SELECT * INTO v_obra FROM obras WHERE id = v_presupuesto.obra_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La obra del presupuesto no existe (id: %)', v_presupuesto.obra_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Generar remito solo si hay insumos (issue 2.4)
  SELECT COUNT(*) INTO v_count_insumos
    FROM presupuesto_insumos WHERE presupuesto_id = p_id;

  IF v_count_insumos > 0 THEN
    v_numero_remito := generar_numero_remito();

    INSERT INTO remitos (numero, estado, obra, responsable, fecha_egreso, observacion)
    VALUES (
      v_numero_remito,
      'BORRADOR',
      v_obra.nombre,
      '-- por completar --',
      CURRENT_DATE,
      'Generado automaticamente desde presupuesto ' || v_presupuesto.numero
    )
    RETURNING id INTO v_remito_id;

    INSERT INTO remito_materiales (remito_id, material_id, cantidad_egreso, unidad)
    SELECT v_remito_id, pi.material_id, pi.cantidad, COALESCE(m.unidad, 'unidad')
      FROM presupuesto_insumos pi
      LEFT JOIN materiales m ON m.id = pi.material_id
     WHERE pi.presupuesto_id = p_id;
  END IF;

  -- Actualizar presupuesto
  UPDATE presupuestos SET
    estado             = 'APROBADO',
    fecha_aprobacion   = now(),
    aprobado_por       = p_user_id,
    remito_generado_id = v_remito_id
  WHERE id = p_id;

  -- Sincronizar obra: si no esta FINALIZADA, pasa a ACTIVA
  IF v_obra.estado != 'FINALIZADA' THEN
    UPDATE obras SET estado = 'ACTIVA' WHERE id = v_presupuesto.obra_id;
  END IF;

  RETURN v_remito_id;
END;
$$;
