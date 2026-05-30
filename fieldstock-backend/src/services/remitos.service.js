// src/services/remitos.service.js
/**
 * Service del M5 — Remitos.
 *
 * Un remito modela el ciclo de vida de una salida de herramientas/materiales
 * a una obra y su retorno. Es una MÁQUINA DE ESTADOS lineal:
 *
 *   BORRADOR → CONFIRMADO → EN_TRANSITO → EN_OBRA →
 *   EN_RETORNO → EN_TRANSITO_RETORNO → CERRADO
 *
 * Reglas transversales:
 * - Solo se pueden editar y agregar/quitar items en estado BORRADOR.
 * - Pasar de BORRADOR a CONFIRMADO marca las herramientas como EN_OBRA y
 *   descuenta el stock de los materiales del catálogo (lado-efecto crítico).
 * - Pasar a CERRADO aplica el estado de retorno por herramienta (DISPONIBLE,
 *   EN_MANTENIMIENTO si volvió rota, BAJA vía RPC si se perdió) y repone el
 *   stock de los materiales que volvieron.
 * - Eliminar solo permitido en CERRADO y siempre que no queden herramientas
 *   colgadas EN_OBRA.
 *
 * Side effects relevantes (escriben en otras tablas):
 *  · `herramientas.estado`         — avanzarEstado, volverABorrador
 *  · `materiales.stock_actual`     — vía updateStock() de materiales.service
 *  · `dar_baja_herramienta` (RPC)  — cuando una herramienta se pierde
 *  · `materiales` (insert)         — materiales libres que vuelven y no
 *                                    existían en el catálogo se crean solos
 *  · `movimientos` (insert)        — audit trail inmutable; se inserta
 *                                    automáticamente al avanzar estados
 *                                    de remito que tocan herramientas
 *                                    (issue #1):
 *                                    · BORRADOR→CONFIRMADO → EGRESO
 *                                    · CIERRE con VUELVE     → INGRESO
 *                                    · CIERRE con ROTA       → MANTENIMIENTO
 *                                    · CIERRE con PERDIDA    → BAJA vía RPC
 *                                                              dar_baja_herramienta
 *                                                              (audita por su cuenta)
 *  · `notificaciones` (insert)     — reportarProblema crea una al detectar
 *                                    un problema al llegar a obra (issue #7)
 */
import { supabase } from '../config/supabase.js'
import { updateStock } from './materiales.service.js'
import * as NotifService from './notificaciones.service.js'

// ── Generar número correlativo desde una RPC de Postgres ─────
async function generarNumero() {
  const { data, error } = await supabase.rpc('generar_numero_remito')
  if (error) throw error
  return data
}

// ── Tabla de transiciones permitidas (estado actual → siguiente) ──
// avanzarEstado() consulta este mapa para validar y aplicar.
const TRANSICIONES = {
  BORRADOR:            'CONFIRMADO',
  CONFIRMADO:          'EN_TRANSITO',
  EN_TRANSITO:         'EN_OBRA',
  EN_OBRA:             'EN_RETORNO',
  EN_RETORNO:          'EN_TRANSITO_RETORNO',
  EN_TRANSITO_RETORNO: 'CERRADO',
}

// ── Listar remitos (con filtro por estado y búsqueda libre) ──
export async function getAll({ estado, q } = {}) {
  let query = supabase
    .from('remitos_resumen')   // vista con joins precomputados
    .select('*')
    .order('fecha_egreso', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  // Búsqueda OR sobre obra o número
  if (q)      query = query.or(`obra.ilike.%${q}%,numero.ilike.%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Lookup por número (issue #11) ──────────────────────────────
// Resuelve el QR escaneado del remito (formato FS-NNNNN) al id real.
// maybeSingle() en lugar de single() para no tirar PGRST116 cuando no
// existe — devolvemos null y el controller responde 404 limpio.
export async function getByNumero(numero) {
  const { data, error } = await supabase
    .from('remitos').select('*').eq('numero', numero).maybeSingle()
  if (error) throw error
  return data
}

// ── Detalle: cabecera + items de herramientas + items de materiales ─
// Las tres queries se lanzan en paralelo para minimizar latencia.
export async function getById(id) {
  const [
    { data: remito,     error: errR },
    { data: items,      error: errI },
    { data: materiales, error: errM },
  ] = await Promise.all([
    supabase.from('remitos_resumen').select('*').eq('id', id).single(),
    supabase.from('remito_items_completo').select('*').eq('remito_id', id),
    supabase.from('remito_materiales_completo').select('*').eq('remito_id', id),
  ])

  if (errR) throw errR
  if (errI) throw errI
  if (errM) throw errM

  return { ...remito, items: items ?? [], materiales: materiales ?? [] }
}

// ── Crear un remito nuevo (siempre arranca en BORRADOR) ─────
export async function create(body) {
  const numero = await generarNumero()

  const { data, error } = await supabase
    .from('remitos')
    .insert({
      numero,
      estado:             'BORRADOR',
      obra:               body.obra,
      responsable:        body.responsable,
      // Vínculo con el usuario logueado que creó el remito. Permite que
      // el PDF muestre tel del responsable joineado desde la tabla
      // usuarios (en vez de un campo texto separado). Opcional para
      // backwards-compat con remitos creados antes del login.
      responsable_user_id: body.responsableUserId || null,
      empresa_transporte: body.empresaTransporte || null,
      transporte_id:      body.transporteId      || null,
      cliente_id:         body.clienteId         || null,
      // Si no se especifica fecha de egreso, se usa la fecha de hoy
      fecha_egreso:       body.fechaEgreso || new Date().toISOString().split('T')[0],
      observacion:        body.observacion || null,
    })
    .select().single()

  if (error) throw error
  return data
}

// ── Editar cabecera del remito ────────────────────────────────
// Solo permitido en BORRADOR o CONFIRMADO; en estados posteriores el
// remito se considera "en circulación" y sus datos quedan congelados.
export async function update(id, body) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  if (!['BORRADOR', 'CONFIRMADO'].includes(remito.estado)) {
    const err = new Error('Solo se pueden editar remitos en estado BORRADOR o CONFIRMADO')
    err.status = 400; throw err
  }

  // Solo se mandan al UPDATE los campos que vinieron en el body (undefined-safe)
  const campos = {}
  if (body.obra              !== undefined) campos.obra               = body.obra
  if (body.responsable       !== undefined) campos.responsable        = body.responsable
  if (body.empresaTransporte !== undefined) campos.empresa_transporte = body.empresaTransporte || null
  if (body.fechaEgreso       !== undefined) campos.fecha_egreso       = body.fechaEgreso
  if (body.observacion       !== undefined) campos.observacion        = body.observacion || null

  if (!Object.keys(campos).length) {
    const err = new Error('No hay campos para actualizar')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remitos').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Rollback manual de CONFIRMADO → BORRADOR ──────────────────
// Revierte los side-effects del avance: libera las herramientas (EN_OBRA →
// DISPONIBLE) y repone el stock de los materiales que se habían descontado.
export async function volverABorrador(id) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  if (remito.estado !== 'CONFIRMADO') {
    const err = new Error('Solo se puede volver a Borrador desde estado CONFIRMADO')
    err.status = 400; throw err
  }

  // Reset de herramientas: vuelven a DISPONIBLE
  const { data: items } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', id)

  if (items?.length) {
    await supabase.from('herramientas')
      .update({ estado: 'DISPONIBLE' })
      .in('id', items.map(i => i.herramienta_id))
  }

  // Reposición de stock: solo aplica a materiales del catálogo (con material_id)
  const { data: mats } = await supabase
    .from('remito_materiales')
    .select('material_id, cantidad_egreso')
    .eq('remito_id', id)
    .not('material_id', 'is', null)

  for (const m of (mats ?? [])) {
    await updateStock(m.material_id, m.cantidad_egreso, 'reponer')
  }

  const { data, error } = await supabase
    .from('remitos').update({ estado: 'BORRADOR' }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Agregar una herramienta al remito ─────────────────────────
// Solo permitido en BORRADOR y solo si la herramienta está DISPONIBLE.
export async function addItem(remitoId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar herramientas en estado BORRADOR')
    err.status = 400; throw err
  }

  const { data: herr } = await supabase
    .from('herramientas').select('estado, nombre').eq('id', body.herramientaId).single()

  if (herr?.estado !== 'DISPONIBLE') {
    const err = new Error(`La herramienta "${herr?.nombre}" no está disponible`)
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remito_items')
    .insert({
      remito_id:      remitoId,
      herramienta_id: body.herramientaId,
      estado_salida:  body.estadoSalida || 'BUENO',
      observacion:    body.observacion  || null,
    })
    .select().single()

  if (error) throw error
  return data
}

export async function removeItem(remitoId, itemId) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden quitar herramientas en estado BORRADOR')
    err.status = 400; throw err
  }

  const { error } = await supabase
    .from('remito_items').delete().eq('id', itemId).eq('remito_id', remitoId)
  if (error) throw error
}

// ── Agregar un material al remito ─────────────────────────────
// Acepta dos modos: material del catálogo (materialId) o material libre
// (descripcionLibre). Si es del catálogo, valida que haya stock suficiente.
export async function addMaterial(remitoId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar materiales en estado BORRADOR')
    err.status = 400; throw err
  }

  // Validación de stock disponible solo si es material del catálogo
  if (body.materialId) {
    const { data: mat } = await supabase
      .from('materiales').select('stock_actual, nombre').eq('id', body.materialId).single()
    if (mat.stock_actual < body.cantidad) {
      const err = new Error(`Stock insuficiente de "${mat.nombre}". Disponible: ${mat.stock_actual}`)
      err.status = 400; throw err
    }
  }

  const { data, error } = await supabase
    .from('remito_materiales')
    .insert({
      remito_id:         remitoId,
      material_id:       body.materialId       || null,
      descripcion_libre: body.descripcionLibre || null,
      cantidad_egreso:   body.cantidad,
      unidad:            body.unidad           || 'unidad',
      observacion:       body.observacion      || null,
    })
    .select().single()

  if (error) throw error
  return data
}

export async function removeMaterial(remitoId, materialItemId) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden quitar materiales en estado BORRADOR')
    err.status = 400; throw err
  }

  const { error } = await supabase
    .from('remito_materiales').delete()
    .eq('id', materialItemId).eq('remito_id', remitoId)
  if (error) throw error
}

// ── Registrar estado de retorno de una herramienta ────────────
// Solo válido en EN_RETORNO. Define qué pasa con la herramienta al cerrar
// el remito: VUELVE → DISPONIBLE, ROTA → EN_MANTENIMIENTO, PERDIDA → BAJA,
// QUEDA_EN_OBRA → sigue EN_OBRA. La aplicación real se hace en CERRADO.
export async function updateItemRetorno(remitoId, itemId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'EN_RETORNO') {
    const err = new Error('Solo se puede actualizar el retorno en estado EN_RETORNO')
    err.status = 400; throw err
  }

  const ESTADOS_VALIDOS = ['VUELVE','QUEDA_EN_OBRA','PERDIDA','ROTA']
  if (!ESTADOS_VALIDOS.includes(body.estadoRetorno)) {
    const err = new Error(`Estado de retorno inválido: ${body.estadoRetorno}`)
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remito_items')
    .update({ estado_retorno: body.estadoRetorno, observacion: body.observacion || null })
    .eq('id', itemId).eq('remito_id', remitoId)
    .select().single()

  if (error) throw error
  return data
}

// ── Registrar cantidad que volvió de un material ──────────────
export async function updateMaterialRetorno(remitoId, materialItemId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'EN_RETORNO') {
    const err = new Error('Solo se puede actualizar el retorno en estado EN_RETORNO')
    err.status = 400; throw err
  }

  if (body.cantidadRetorno < 0) {
    const err = new Error('La cantidad de retorno no puede ser negativa')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('remito_materiales')
    .update({ cantidad_retorno: body.cantidadRetorno, observacion: body.observacion || null })
    .eq('id', materialItemId).eq('remito_id', remitoId)
    .select().single()

  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────────
// avanzarEstado: corazón de la máquina de estados.
// Para cada transición que requiere side-effects, aplica los cambios ANTES
// de avanzar el estado del remito en sí (al final). Si algo falla en el
// medio, el estado del remito queda donde estaba (la última escritura no
// se ejecuta), aunque los side-effects parciales NO se reintentan — no hay
// transacciones en este flujo, asumimos consistencia eventual.
// ─────────────────────────────────────────────────────────────────
export async function avanzarEstado(id, body = {}) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('*').eq('id', id).single()
  if (errR) throw errR

  const nuevoEstado = TRANSICIONES[remito.estado]
  if (!nuevoEstado) {
    const err = new Error(`El remito ya está en estado final: ${remito.estado}`)
    err.status = 400; throw err
  }

  // Fecha compartida entre los inserts a `movimientos` que dispara cada
  // transición (steps del issue #1). Una sola lectura del clock por avance.
  const fechaHoy = new Date().toISOString().split('T')[0]

  // ── Transición BORRADOR → CONFIRMADO ──────────────────────────
  // Valida que el remito tenga al menos un item; bloquea las herramientas
  // (EN_OBRA) y descuenta stock de los materiales del catálogo.
  if (remito.estado === 'BORRADOR') {
    const [{ data: items }, { data: mats }] = await Promise.all([
      supabase.from('remito_items').select('id, herramienta_id').eq('remito_id', id),
      supabase.from('remito_materiales').select('id').eq('remito_id', id),
    ])

    if (!items?.length && !mats?.length) {
      const err = new Error('El remito debe tener al menos una herramienta o un material')
      err.status = 400; throw err
    }

    // Pasar todas las herramientas a EN_OBRA en un solo UPDATE
    if (items?.length) {
      await supabase.from('herramientas')
        .update({ estado: 'EN_OBRA' })
        .in('id', items.map(i => i.herramienta_id))

      // ── Auto-registrar movimientos EGRESO (issue #1 — paso 1) ──
      // Audit trail: cada herramienta que sale a obra gana una fila
      // inmutable en `movimientos`, con obra/responsable del remito.
      // Decisión: BAJA por PERDIDA NO genera un movimiento extra acá
      // porque la RPC `dar_baja_herramienta` ya audita por su cuenta.
      await supabase.from('movimientos').insert(
        items.map(i => ({
          herramienta_id: i.herramienta_id,
          tipo:           'EGRESO',
          fecha:          fechaHoy,
          obra:           remito.obra,
          responsable:    remito.responsable,
          observacion:    `Auto-generado desde remito ${remito.numero}`,
        }))
      )
    }

    // Descontar stock material por material (no es batch porque cada uno
    // requiere validar stock vía updateStock)
    const { data: matsConId } = await supabase
      .from('remito_materiales')
      .select('material_id, cantidad_egreso')
      .eq('remito_id', id)
      .not('material_id', 'is', null)

    for (const m of (matsConId ?? [])) {
      await updateStock(m.material_id, m.cantidad_egreso, 'descontar')
    }
  }

  // ── Transición EN_RETORNO → EN_TRANSITO_RETORNO ───────────────
  // Bloquea avance si quedan items sin definir su estado de retorno.
  // Excluye los items marcados como extraviados (Word C2): no tienen
  // estado de retorno porque nunca llegaron a la obra — no hay nada
  // que volver.
  if (remito.estado === 'EN_RETORNO') {
    const { data: items } = await supabase
      .from('remito_items')
      .select('id, estado_retorno, extraviado')
      .eq('remito_id', id)

    const sinRetorno = items?.filter(i => !i.estado_retorno && !i.extraviado)
    if (sinRetorno?.length) {
      const err = new Error(`Faltan definir el estado de retorno de ${sinRetorno.length} herramienta(s)`)
      err.status = 400; throw err
    }

    // Marca la fecha de retorno (hoy) en la cabecera
    await supabase.from('remitos')
      .update({ fecha_retorno: new Date().toISOString().split('T')[0] })
      .eq('id', id)
  }

  // ── Transición EN_TRANSITO_RETORNO → CERRADO ──────────────────
  // Aquí se materializan los efectos finales sobre el inventario:
  // 1. Herramientas pasan a su estado según estado_retorno
  // 2. Materiales del catálogo que vuelven → stock repuesto
  // 3. Materiales libres que vuelven → se agregan al catálogo o suman a uno existente
  if (remito.estado === 'EN_TRANSITO_RETORNO') {
    const { data: items } = await supabase
      .from('remito_items')
      .select('herramienta_id, estado_retorno, extraviado')
      .eq('remito_id', id)

    // Aplica el estado final por herramienta según cómo volvió.
    // Los items extraviados (Word C2) se omiten: nunca llegaron, así que no
    // hay estado final que aplicar. La herramienta queda en EN_OBRA en la
    // tabla `herramientas` — el usuario puede darle de baja manualmente
    // con la RPC dar_baja_herramienta si decide considerarla perdida.
    for (const item of (items ?? [])) {
      if (item.extraviado) continue
      if (item.estado_retorno === 'VUELVE') {
        await supabase.from('herramientas')
          .update({ estado: 'DISPONIBLE' }).eq('id', item.herramienta_id)
        // ── Movimiento INGRESO (issue #1 — paso 2) ──
        // La herramienta vuelve sana al galpón: audit trail correspondiente.
        await supabase.from('movimientos').insert({
          herramienta_id: item.herramienta_id,
          tipo:           'INGRESO',
          fecha:          fechaHoy,
          obra:           remito.obra,
          responsable:    remito.responsable,
          observacion:    `Devolución desde remito ${remito.numero}`,
        })
      } else if (item.estado_retorno === 'ROTA') {
        await supabase.from('herramientas')
          .update({ estado: 'EN_MANTENIMIENTO' }).eq('id', item.herramienta_id)
        // ── Movimiento MANTENIMIENTO (issue #1 — paso 3) ──
        // La herramienta vuelve rota: requiere reparación. El audit trail
        // queda explícito para que el historial muestre por qué pasó a
        // EN_MANTENIMIENTO sin acción manual.
        await supabase.from('movimientos').insert({
          herramienta_id: item.herramienta_id,
          tipo:           'MANTENIMIENTO',
          fecha:          fechaHoy,
          obra:           remito.obra,
          responsable:    remito.responsable,
          observacion:    `Devolución rota desde remito ${remito.numero}`,
        })
      } else if (item.estado_retorno === 'PERDIDA') {
        // BAJA va vía RPC porque es una transición terminal con auditoría
        await supabase.rpc('dar_baja_herramienta', {
          p_id: item.herramienta_id,
          p_motivo: 'Pérdida registrada en remito ' + remito.numero
        })
      }
      // QUEDA_EN_OBRA: no se toca, queda con estado EN_OBRA
    }

    // Reponer stock de materiales del catálogo que volvieron en cantidad > 0
    const { data: mats } = await supabase
      .from('remito_materiales')
      .select('material_id, cantidad_retorno')
      .eq('remito_id', id)
      .not('material_id', 'is', null)
      .not('cantidad_retorno', 'is', null)
      .gt('cantidad_retorno', 0)

    for (const m of (mats ?? [])) {
      await updateStock(m.material_id, m.cantidad_retorno, 'reponer')
    }

    // Materiales LIBRES que volvieron: si coinciden por nombre con uno del
    // catálogo se suman; si no, se crean como ítem nuevo del catálogo.
    const { data: matsLibres } = await supabase
      .from('remito_materiales')
      .select('descripcion_libre, cantidad_retorno, unidad')
      .eq('remito_id', id)
      .is('material_id', null)
      .not('cantidad_retorno', 'is', null)
      .gt('cantidad_retorno', 0)

    for (const m of (matsLibres ?? [])) {
      const { data: existente } = await supabase
        .from('materiales').select('id, stock_actual')
        .ilike('nombre', m.descripcion_libre)
        .maybeSingle()

      if (existente) {
        await supabase.from('materiales')
          .update({ stock_actual: existente.stock_actual + m.cantidad_retorno })
          .eq('id', existente.id)
      } else {
        await supabase.from('materiales').insert({
          nombre:       m.descripcion_libre,
          unidad:       m.unidad || 'unidad',
          stock_actual: m.cantidad_retorno,
          stock_minimo: 0,
          descripcion:  'Creado automáticamente desde retorno de remito',
        })
      }
    }

    // Observación de cierre opcional
    if (body.observacionRetorno) {
      await supabase.from('remitos')
        .update({ observacion_retorno: body.observacionRetorno })
        .eq('id', id)
    }
  }

  // Avance real del estado (última escritura)
  const { data, error } = await supabase
    .from('remitos').update({ estado: nuevoEstado }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Reportar problema al llegar a obra (issue #7 + Word C + C2) ──
// Variante del 2° escaneo del QR desde la app mobile.
//
// Word C: granular por ítem (no solo descripción genérica).
// Word C2: cada ítem afectado puede marcarse como EXTRAVIADO (no llegó)
// o como problema regular (llegó pero con defecto). Si TODOS los ítems
// del remito quedan extraviados, el remito va directamente a CERRADO
// (saltando EN_OBRA y el flow de retorno — no tiene sentido esperar
// que vuelva algo que nunca llegó).
//
// Body acepta:
//   { descripcion?: string,
//     items?:     [{ remitoItemId,    descripcion, extraviado: boolean }],
//     materiales?:[{ remitoMaterialId, descripcion, extraviado: boolean }] }
//
// Efectos en orden:
//   1) Marca los items/materiales con tiene_problema=true (+ extraviado
//      si corresponde) y guarda descripción puntual en observacion.
//   2) Persiste la descripción general en remito.observacion_llegada.
//   3) Decide el estado destino:
//      - Si TODOS los ítems del remito están extraviados → CERRADO directo
//      - Sino → flow normal (avanzarEstado: EN_TRANSITO → EN_OBRA)
//   4) Crea una notificación PROBLEMA_LLEGADA con el contexto.
export async function reportarProblema(id, body = {}) {
  // Acepta tanto la firma vieja (string directamente) como la nueva (objeto).
  // Esto preserva backwards-compat por si algún caller no migró.
  const payload = typeof body === 'string' ? { descripcion: body } : body
  const { descripcion = '', items = [], materiales = [] } = payload

  const desc = descripcion?.trim() || ''
  const itemsLimpios     = (items || []).filter(it => it?.remitoItemId)
  const materialesLimpios = (materiales || []).filter(m => m?.remitoMaterialId)
  const totalItems = itemsLimpios.length + materialesLimpios.length

  if (!desc && totalItems === 0) {
    const err = new Error('Indicá la descripción del problema o al menos un ítem afectado')
    err.status = 400; throw err
  }

  const { data: remito, error: errR } = await supabase
    .from('remitos').select('*').eq('id', id).single()
  if (errR) throw errR
  if (!remito) {
    const err = new Error('Remito no encontrado')
    err.status = 404; throw err
  }

  if (remito.estado !== 'EN_TRANSITO') {
    const err = new Error(
      `No se puede reportar problema: el remito está en estado ${remito.estado}. ` +
      `Solo se admite en EN_TRANSITO.`
    )
    err.status = 400; throw err
  }

  // 1) Marcar items de herramientas afectados. Filtramos por remito_id como
  //    safety check para evitar que un body manipulado afecte items de otro
  //    remito por confusión de IDs.
  for (const it of itemsLimpios) {
    const { error: e } = await supabase
      .from('remito_items')
      .update({
        tiene_problema: true,
        extraviado:     !!it.extraviado,
        observacion:    it.descripcion?.trim() || null,
      })
      .eq('id', it.remitoItemId)
      .eq('remito_id', id)
    if (e) throw e
  }

  // 1b) Marcar materiales afectados
  for (const m of materialesLimpios) {
    const { error: e } = await supabase
      .from('remito_materiales')
      .update({
        tiene_problema: true,
        extraviado:     !!m.extraviado,
        observacion:    m.descripcion?.trim() || null,
      })
      .eq('id', m.remitoMaterialId)
      .eq('remito_id', id)
    if (e) throw e
  }

  // 2) Descripción general del problema en la cabecera del remito
  await supabase.from('remitos')
    .update({ observacion_llegada: desc || null })
    .eq('id', id)

  // 3) Detectar caso de extravío TOTAL: si todos los ítems del remito
  //    (después de los updates de arriba) están marcados como extraviados,
  //    el remito va directo a CERRADO. No tiene sentido esperar retorno
  //    de algo que nunca llegó.
  const { data: allItems, error: errA } = await supabase
    .from('remito_items').select('id, extraviado').eq('remito_id', id)
  if (errA) throw errA
  const { data: allMats, error: errB } = await supabase
    .from('remito_materiales').select('id, extraviado').eq('remito_id', id)
  if (errB) throw errB

  const totalRemito  = (allItems?.length || 0) + (allMats?.length || 0)
  const extraviados  = (allItems || []).filter(i => i.extraviado).length +
                       (allMats  || []).filter(m => m.extraviado).length
  const extravioTotal = totalRemito > 0 && extraviados === totalRemito

  // 4) Notificación al sistema. Título contextual: distingue "X items
  //    afectados" del caso especial "EXTRAVÍO TOTAL". Como la tabla
  //    notificaciones no tiene user_id (es global), creamos una sola fila.
  let titulo
  if (extravioTotal) {
    titulo = `⚠ Extravío TOTAL del remito ${remito.numero}`
  } else if (totalItems > 0) {
    titulo = `Problema en remito ${remito.numero}: ${totalItems} ítem${totalItems !== 1 ? 's' : ''} afectado${totalItems !== 1 ? 's' : ''}`
  } else {
    titulo = `Problema en remito ${remito.numero}`
  }
  const mensaje = `Obra: ${remito.obra}. ${desc || 'Sin descripción general.'}`

  await NotifService.create({
    tipo:     'PROBLEMA_LLEGADA',
    titulo,
    mensaje,
    remitoId: id,
  })

  // 5) Avance del estado. Atajo si fue extravío total → CERRADO directo
  //    (saltando el state machine normal). Sino, EN_TRANSITO → EN_OBRA
  //    como antes.
  if (extravioTotal) {
    const { data, error } = await supabase
      .from('remitos').update({ estado: 'CERRADO' }).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  return avanzarEstado(id)
}

// ── Eliminar remito cerrado ───────────────────────────────────
// Solo en CERRADO y solo si ya no quedan herramientas del remito EN_OBRA
// (puede pasar si alguien marcó QUEDA_EN_OBRA y olvidaron registrar el retorno).
export async function eliminar(id) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR

  if (remito.estado !== 'CERRADO') {
    const err = new Error('Solo se pueden eliminar remitos en estado CERRADO')
    err.status = 400; throw err
  }

  const { data: items } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', id)

  if (items?.length) {
    const { data: herrsEnObra } = await supabase
      .from('herramientas').select('id')
      .in('id', items.map(i => i.herramienta_id))
      .eq('estado', 'EN_OBRA')

    if (herrsEnObra?.length) {
      const err = new Error('No se puede eliminar: hay herramientas del remito que aún están en obra')
      err.status = 400; throw err
    }
  }

  const { error } = await supabase.from('remitos').delete().eq('id', id)
  if (error) throw error
}

// ── Confirmar escaneo desde el QR mobile ──────────────────────
// Maneja 3 transiciones que el responsable puede confirmar desde el QR:
//
//   - CONFIRMADO          → EN_TRANSITO       (SALIDA, conductor obligatorio)
//   - EN_TRANSITO         → EN_OBRA           (LLEGADA a obra)
//   - EN_TRANSITO_RETORNO → CERRADO           (LLEGADA_GALPON: retorno completado)
//
// Cualquier otro estado devuelve 400.
//
// Devuelve { data: remito, accion } para que la UI mobile sepa qué
// mensaje mostrar tras la confirmación.
const ESTADOS_QR_ACCION = {
  CONFIRMADO:          'SALIDA',
  EN_TRANSITO:         'LLEGADA',
  EN_TRANSITO_RETORNO: 'LLEGADA_GALPON',
}

export async function confirmarEscaneo(id, { conductor } = {}) {
  const { data: remito, error: errR } = await supabase
    .from('remitos').select('estado').eq('id', id).single()
  if (errR) throw errR
  if (!remito) {
    const err = new Error('Remito no encontrado'); err.status = 404; throw err
  }

  const accion = ESTADOS_QR_ACCION[remito.estado]
  if (!accion) {
    const err = new Error(
      `El remito está en estado ${remito.estado} y no puede confirmarse por QR.`
    )
    err.status = 400; throw err
  }

  // En la SALIDA se persiste el conductor antes de avanzar el estado.
  // En las demás (LLEGADA, LLEGADA_GALPON) no hace falta porque ya quedó.
  if (accion === 'SALIDA') {
    if (!conductor?.trim()) {
      const err = new Error('Hay que indicar el nombre del conductor o persona a cargo del traslado.')
      err.status = 400; throw err
    }
    const { error: errU } = await supabase
      .from('remitos')
      .update({ conductor: conductor.trim() })
      .eq('id', id)
    if (errU) throw errU
  }

  const data = await avanzarEstado(id)
  return { data, accion }
}
