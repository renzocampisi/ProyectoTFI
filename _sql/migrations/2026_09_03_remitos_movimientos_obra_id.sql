-- Vincula remitos y movimientos a su obra por ID (FK), en vez de solo por
-- nombre de texto. Mismo patrón que ya existe en obras.cliente_id: el FK
-- pasa a ser la fuente de verdad; la columna de texto (`obra`) queda como
-- caché de display re-sincronizada desde el FK — no se borra ni se
-- reemplaza de golpe.
--
-- Por qué: getSugerenciasPresupuesto() en remitos.service.js documentaba
-- explícitamente que "la tabla remitos guarda la obra como texto + cliente_id
-- (no como FK a obras)" y resolvía por matching de nombre — un workaround,
-- no un diseño. Con obra_id esa función deja de necesitar el match.
-- También destraba _plans/historial-obra/: agregar remitos/movimientos de
-- una obra pasa a ser un WHERE obra_id = X directo.
--
-- No se toca la vista remitos_resumen (tiene columnas explícitas, no
-- `select *`, y su definición original no está versionada acá — se creó
-- a mano en el editor). No hace falta: nada de lo que este cambio habilita
-- (backfill, resolución de sugerencias, historial) lee esa vista.

ALTER TABLE remitos     ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES obras(id);
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES obras(id);

CREATE INDEX IF NOT EXISTS idx_remitos_obra_id     ON remitos(obra_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_obra_id ON movimientos(obra_id);

-- ── Backfill remitos ──────────────────────────────────────────
-- Mismo criterio que ya usaba getSugerenciasPresupuesto(): nombre +
-- cliente_id, la obra más reciente si hay ambigüedad. Lo que no matchea
-- limpio queda en NULL — sigue mostrando el texto viejo, no se pierde nada.
WITH match AS (
  SELECT DISTINCT ON (r.id) r.id AS remito_id, o.id AS obra_id
    FROM remitos r
    JOIN obras o ON o.nombre = r.obra AND o.cliente_id = r.cliente_id
   WHERE r.obra_id IS NULL
   ORDER BY r.id, o.created_at DESC
)
UPDATE remitos SET obra_id = match.obra_id
  FROM match WHERE remitos.id = match.remito_id;

-- ── Backfill movimientos ──────────────────────────────────────
-- movimientos no tiene cliente_id, así que el match es solo por nombre.
-- Se backfillea ÚNICAMENTE cuando el nombre es inequívoco (una sola obra
-- con ese nombre en todo el sistema, sin importar cliente) — ambiguo se
-- deja en NULL antes que adivinar mal.
WITH conteo AS (
  SELECT nombre FROM obras GROUP BY nombre HAVING COUNT(*) = 1
),
nombres_unicos AS (
  -- uuid no tiene MIN/MAX nativo; como conteo ya garantiza una sola obra
  -- por nombre, el join directo alcanza sin necesidad de agregarlo.
  SELECT o.nombre, o.id AS obra_id
    FROM obras o
    JOIN conteo c ON c.nombre = o.nombre
)
UPDATE movimientos SET obra_id = nombres_unicos.obra_id
  FROM nombres_unicos
 WHERE movimientos.obra = nombres_unicos.nombre
   AND movimientos.obra_id IS NULL;

-- ── RPC aprobar_presupuesto: ahora también setea obra_id ──────
-- Mismo cuerpo y firma que 2026_06_15_presupuestos_rls_y_rpc.sql — el
-- único cambio es sumar obra_id a la fila de remitos que genera.
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
  SELECT * INTO v_presupuesto FROM presupuestos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_presupuesto.estado != 'EN_APROBACION' THEN
    RAISE EXCEPTION 'Solo EN_APROBACION puede aprobarse (estado actual: %)', v_presupuesto.estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_obra FROM obras WHERE id = v_presupuesto.obra_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La obra del presupuesto no existe (id: %)', v_presupuesto.obra_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*) INTO v_count_insumos
    FROM presupuesto_insumos WHERE presupuesto_id = p_id;

  IF v_count_insumos > 0 THEN
    v_numero_remito := generar_numero_remito();

    INSERT INTO remitos (numero, estado, obra, obra_id, responsable, fecha_egreso, observacion)
    VALUES (
      v_numero_remito,
      'BORRADOR',
      v_obra.nombre,
      v_obra.id,
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

  UPDATE presupuestos SET
    estado             = 'APROBADO',
    fecha_aprobacion   = now(),
    aprobado_por       = p_user_id,
    remito_generado_id = v_remito_id
  WHERE id = p_id;

  IF v_obra.estado != 'FINALIZADA' THEN
    UPDATE obras SET estado = 'ACTIVA' WHERE id = v_presupuesto.obra_id;
  END IF;

  RETURN v_remito_id;
END;
$$;
