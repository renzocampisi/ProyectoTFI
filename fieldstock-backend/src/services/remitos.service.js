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

  // Reset de herramientas: vuelven a RESERVADA (no DISPONIBLE), porque
  // el remito vuelve a BORRADOR y las herramientas siguen asociadas a el.
  // Quedaran liberadas a DISPONIBLE solo cuando se quiten del remito
  // (removeItem) o cuando ningun otro borrador las tenga.
  const { data: items } = await supabase
    .from('remito_items').select('herramienta_id').eq('remito_id', id)

  if (items?.length) {
    await supabase.from('herramientas')
      .update({ estado: 'RESERVADA' })
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
// Solo permitido en BORRADOR. Reglas según estado de la herramienta:
//   - DISPONIBLE → aceptar, item insertado + herramienta pasa a RESERVADA.
//   - RESERVADA  → si NO se mando forzar=true, devolver 409 con info del
//                  otro(s) borrador(es). El frontend muestra confirmacion
//                  "ya esta en el borrador X, agregar igual?" y reintenta
//                  con forzar=true. La herramienta queda asociada a ambos
//                  borradores — el primero que confirme se la lleva, el
//                  segundo va a fallar al avanzar (chequeo en avanzarEstado).
//   - cualquier otro estado (EN_OBRA, EN_MANTENIMIENTO, RESERVADA por motivo
//     que no sea borrador, BAJA): rechazar 400 — la herramienta no esta
//     fisicamente en el galpon.
export async function addItem(remitoId, body) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden agregar herramientas en estado BORRADOR')
    err.status = 400; throw err
  }

  const { data: herr } = await supabase
    .from('herramientas').select('estado, nombre').eq('id', body.herramientaId).single()

  if (!herr) {
    const err = new Error('Herramienta no encontrada')
    err.status = 404; throw err
  }

  if (herr.estado === 'RESERVADA') {
    // Si ya esta reservada en algun otro BORRADOR y no se forzo: 409 con info.
    if (!body.forzar) {
      const { data: otros } = await supabase
        .from('remito_items')
        .select('remito:remitos(id, numero, obra, estado)')
        .eq('herramienta_id', body.herramientaId)
      const otrosBorradores = (otros || [])
        .map(o => o.remito)
        .filter(r => r && r.estado === 'BORRADOR' && r.id !== remitoId)
      if (otrosBorradores.length) {
        const err = new Error(
          `La herramienta "${herr.nombre}" ya esta reservada en el borrador ${otrosBorradores[0].numero}`
        )
        err.status = 409
        err.data = { herramienta: herr.nombre, enUsoEn: otrosBorradores }
        throw err
      }
      // Reservada pero no encontre el borrador: estado inconsistente,
      // dejarla pasar como si fuera DISPONIBLE (la liberamos abajo).
    }
  } else if (herr.estado !== 'DISPONIBLE') {
    const err = new Error(`La herramienta "${herr.nombre}" no esta disponible (estado: ${herr.estado})`)
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

  // Pasar la herramienta a RESERVADA (si ya estaba RESERVADA por otro
  // borrador, el UPDATE es idempotente — sigue RESERVADA).
  await supabase.from('herramientas')
    .update({ estado: 'RESERVADA' })
    .eq('id', body.herramientaId)

  return data
}

export async function removeItem(remitoId, itemId) {
  const { data: remito } = await supabase
    .from('remitos').select('estado').eq('id', remitoId).single()

  if (remito?.estado !== 'BORRADOR') {
    const err = new Error('Solo se pueden quitar herramientas en estado BORRADOR')
    err.status = 400; throw err
  }

  // Antes de borrar el item, capturo el herramienta_id para poder
  // liberar el estado RESERVADA si esta herramienta no queda en ningun
  // otro borrador.
  const { data: itemActual } = await supabase
    .from('remito_items').select('herramienta_id')
    .eq('id', itemId).eq('remito_id', remitoId).maybeSingle()

  const { error } = await supabase
    .from('remito_items').delete().eq('id', itemId).eq('remito_id', remitoId)
  if (error) throw error

  // Liberar a DISPONIBLE solo si la herramienta ya no esta en NINGUN otro
  // remito BORRADOR. Si sigue en otros borradores, queda RESERVADA.
  if (itemActual?.herramienta_id) {
    const { data: otros } = await supabase
      .from('remito_items')
      .select('remito:remitos(id, estado)')
      .eq('herramienta_id', itemActual.herramienta_id)
    const sigueReservada = (otros || [])
      .some(o => o.remito?.estado === 'BORRADOR')
    if (!sigueReservada) {
      await supabase.from('herramientas')
        .update({ estado: 'DISPONIBLE' })
        .eq('id', itemActual.herramienta_id)
        .eq('estado', 'RESERVADA')  // proteccion contra cambio si paso a EN_OBRA
    }
  }
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
// Acepta:
//   - cantidadRetorno: número >= 0 y <= cantidad_egreso del item.
//   - observacion: texto libre opcional.
//   - extraviado: bool opcional. Permite al frontend marcar/desmarcar el
//     flag cuando el usuario elige "Ninguno" (extraviado=true) vs "Parcial"
//     o "Todos" (extraviado=false), corrigiendo lo que se haya marcado en
//     el escaneo QR de LLEGADA si la realidad cambió al inspeccionar.
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

  // Validación contra el máximo permitido (no se puede recuperar más de lo
  // que salió). Leemos el item para conocer cantidad_egreso.
  const { data: item, error: errItem } = await supabase
    .from('remito_materiales')
    .select('cantidad_egreso')
    .eq('id', materialItemId).eq('remito_id', remitoId).single()
  if (errItem) throw errItem
  if (!item) {
    const err = new Error('Material no encontrado en este remito')
    err.status = 404; throw err
  }
  if (body.cantidadRetorno > Number(item.cantidad_egreso)) {
    const err = new Error(`La cantidad de retorno (${body.cantidadRetorno}) no puede superar lo que salió (${item.cantidad_egreso})`)
    err.status = 400; throw err
  }

  // Solo incluimos `extraviado` y `observacion` en el update si vinieron en
  // el body — undefined preserva el valor actual sin pisarlo con null.
  const campos = { cantidad_retorno: body.cantidadRetorno }
  if (body.observacion !== undefined) campos.observacion = body.observacion || null
  if (body.extraviado !== undefined)  campos.extraviado  = !!body.extraviado

  const { data, error } = await supabase
    .from('remito_materiales')
    .update(campos)
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

    // Pasar todas las herramientas a EN_OBRA en un solo UPDATE.
    // Validacion: si alguna herramienta ya esta EN_OBRA, falla. Esto
    // protege el caso "herramienta en 2 borradores, uno confirma, el
    // otro tambien intenta": el segundo encuentra la herramienta ya
    // ocupada y aborta antes de modificar nada.
    if (items?.length) {
      const ids = items.map(i => i.herramienta_id)
      const { data: ocupadas } = await supabase
        .from('herramientas')
        .select('id, nombre, estado')
        .in('id', ids)
        .eq('estado', 'EN_OBRA')
      if (ocupadas?.length) {
        const nombres = ocupadas.map(h => `"${h.nombre}"`).join(', ')
        const err = new Error(
          `No se puede confirmar: ${ocupadas.length} herramienta(s) ya estan EN_OBRA en otro remito: ${nombres}`
        )
        err.status = 409; throw err
      }
      await supabase.from('herramientas')
        .update({ estado: 'EN_OBRA' })
        .in('id', ids)

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
// Maneja las 4 transiciones que el responsable confirma desde el QR a
// lo largo del ciclo de vida del remito:
//
//   1. CONFIRMADO          → EN_TRANSITO          (SALIDA: sale del galpón, conductor obligatorio)
//   2. EN_TRANSITO         → EN_OBRA              (LLEGADA: llegó a la obra)
//   3. EN_RETORNO          → EN_TRANSITO_RETORNO  (SALIDA_OBRA: arranca el viaje de vuelta)
//   4. EN_TRANSITO_RETORNO → CERRADO              (LLEGADA_GALPON: llegó al galpón, se cierra)
//
// El paso intermedio EN_OBRA → EN_RETORNO sigue siendo manual (el dueño
// inicia el retorno desde la web cuando el responsable ya definió qué
// vuelve y qué no de cada item).
//
// Devuelve { data: remito, accion } para que la UI mobile sepa qué
// mensaje mostrar tras la confirmación.
const ESTADOS_QR_ACCION = {
  CONFIRMADO:          'SALIDA',
  EN_TRANSITO:         'LLEGADA',
  EN_RETORNO:          'SALIDA_OBRA',
  EN_TRANSITO_RETORNO: 'LLEGADA_GALPON',
}

// Estados válidos de retorno por herramienta (espejo del frontend).
// Cualquier valor fuera de este conjunto se rechaza en SALIDA_OBRA.
const ESTADOS_RETORNO_VALIDOS = new Set(['VUELVE', 'ROTA', 'PERDIDA', 'QUEDA_EN_OBRA'])

export async function confirmarEscaneo(id, body = {}) {
  const { conductor, items = [], materiales = [], observacionRetorno } = body

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

  // En la SALIDA_OBRA (EN_RETORNO → EN_TRANSITO_RETORNO) el encargado define
  // desde el QR mobile qué herramientas vuelven y cuánto de cada material.
  // Persistimos los datos antes de avanzar para que la validación de
  // "todos los items tienen estado_retorno" del avanzarEstado pase OK.
  // Los items extraviados se omiten — siguen sin estado_retorno por diseño
  // (avanzarEstado los excluye de la validación).
  // Helper local: construye el objeto de update para un item/material del
  // retorno SIN pisar `observacion` cuando el body no la trae. Esto es
  // importante porque el flow del QR mobile (SALIDA_OBRA y LLEGADA_GALPON)
  // manda solo estado/cantidad — sin la columna observacion. Si la
  // incluyéramos con `it.observacion?.trim() || null`, pisaríamos cualquier
  // observación cargada previamente desde la web por el dueño.
  // Solo se actualiza la observación si vino explícitamente en el payload.
  const buildItemUpdate = (it) => {
    const u = { estado_retorno: it.estadoRetorno }
    if (it.observacion !== undefined) u.observacion = it.observacion?.trim() || null
    return u
  }
  const buildMatUpdate = (m, cant) => {
    const u = { cantidad_retorno: cant }
    if (m.observacion !== undefined) u.observacion = m.observacion?.trim() || null
    return u
  }

  if (accion === 'SALIDA_OBRA') {
    for (const it of items) {
      if (!it?.remitoItemId) continue
      if (!ESTADOS_RETORNO_VALIDOS.has(it.estadoRetorno)) {
        const err = new Error(`estado_retorno inválido para item ${it.remitoItemId}: ${it.estadoRetorno}`)
        err.status = 400; throw err
      }
      const { error: e } = await supabase.from('remito_items')
        .update(buildItemUpdate(it))
        .eq('id', it.remitoItemId)
        .eq('remito_id', id)
      if (e) throw e
    }
    for (const m of materiales) {
      if (!m?.remitoMaterialId) continue
      const cant = Number(m.cantidadRetorno)
      if (!Number.isFinite(cant) || cant < 0) {
        const err = new Error(`cantidad_retorno inválida para material ${m.remitoMaterialId}: ${m.cantidadRetorno}`)
        err.status = 400; throw err
      }
      const { error: e } = await supabase.from('remito_materiales')
        .update(buildMatUpdate(m, cant))
        .eq('id', m.remitoMaterialId)
        .eq('remito_id', id)
      if (e) throw e
    }
  }

  // En la LLEGADA_GALPON (EN_TRANSITO_RETORNO → CERRADO) el encargado puede
  // OVERRIDEAR el estado_retorno y la cantidad_retorno que se definieron en
  // SALIDA_OBRA si encuentra discrepancias al descargar en el galpón:
  //   - Una herramienta que salió como VUELVE pero llegó rota → ROTA
  //   - Una herramienta que se perdió en el viaje de vuelta → PERDIDA
  //   - Material que volvió con cantidad distinta a la declarada → ajustar
  // Si el body llega vacío (botón "Todo OK"), no se toca nada y se cierra
  // con los datos que ya estaban. La observación general del retorno se
  // guarda en `observacion_retorno` (handled por avanzarEstado vía body).
  if (accion === 'LLEGADA_GALPON') {
    for (const it of items) {
      if (!it?.remitoItemId) continue
      if (!ESTADOS_RETORNO_VALIDOS.has(it.estadoRetorno)) {
        const err = new Error(`estado_retorno inválido para item ${it.remitoItemId}: ${it.estadoRetorno}`)
        err.status = 400; throw err
      }
      const { error: e } = await supabase.from('remito_items')
        .update(buildItemUpdate(it))
        .eq('id', it.remitoItemId)
        .eq('remito_id', id)
      if (e) throw e
    }
    for (const m of materiales) {
      if (!m?.remitoMaterialId) continue
      const cant = Number(m.cantidadRetorno)
      if (!Number.isFinite(cant) || cant < 0) {
        const err = new Error(`cantidad_retorno inválida para material ${m.remitoMaterialId}: ${m.cantidadRetorno}`)
        err.status = 400; throw err
      }
      const { error: e } = await supabase.from('remito_materiales')
        .update(buildMatUpdate(m, cant))
        .eq('id', m.remitoMaterialId)
        .eq('remito_id', id)
      if (e) throw e
    }
  }

  // avanzarEstado acepta `observacionRetorno` y lo persiste en la cabecera
  // del remito durante la transición EN_TRANSITO_RETORNO → CERRADO.
  const data = await avanzarEstado(id, { observacionRetorno })
  return { data, accion }
}

// ── Sugerencias de items del presupuesto APROBADO para esta obra ──
// Si la obra del remito tiene un presupuesto APROBADO, devuelve sus insumos
// (material_id + cantidad). Sirve al frontend para marcar visualmente esos
// materiales en el selector y pre-cargar la cantidad sugerida.
//
// Resolucion de la obra: la tabla `remitos` guarda la obra como texto +
// cliente_id (no como FK a `obras`). Hacemos match por nombre dentro del
// mismo cliente — es razonablemente unico en la practica.
//
// Si no hay presupuesto APROBADO (o no se puede resolver la obra), devuelve
// { items: [] } sin error — para el caller es "no hay sugerencias".
export async function getSugerenciasPresupuesto(remitoId) {
  // 1. Datos del remito (obra + cliente_id)
  const { data: remito, error: errR } = await supabase
    .from('remitos')
    .select('obra, cliente_id, estado')
    .eq('id', remitoId)
    .maybeSingle()
  if (errR) throw errR
  if (!remito) return { items: [] }

  // Solo tiene sentido sugerir mientras se pueden editar items (BORRADOR).
  if (remito.estado !== 'BORRADOR') return { items: [] }
  if (!remito.obra || !remito.cliente_id) return { items: [] }

  // 2. Buscar la obra por nombre + cliente_id
  const { data: obra, error: errO } = await supabase
    .from('obras')
    .select('id')
    .eq('nombre', remito.obra)
    .eq('cliente_id', remito.cliente_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (errO) throw errO
  if (!obra) return { items: [] }

  // 3. Ultimo presupuesto APROBADO de esa obra
  const { data: presupuesto, error: errP } = await supabase
    .from('presupuestos')
    .select('id')
    .eq('obra_id', obra.id)
    .eq('estado', 'APROBADO')
    .order('fecha_aprobacion', { ascending: false, nullsLast: true })
    .limit(1)
    .maybeSingle()
  if (errP) throw errP
  if (!presupuesto) return { items: [] }

  // 4. Insumos del presupuesto
  const { data: insumos, error: errI } = await supabase
    .from('presupuesto_insumos')
    .select('material_id, cantidad')
    .eq('presupuesto_id', presupuesto.id)
  if (errI) throw errI

  return {
    presupuestoId: presupuesto.id,
    items: (insumos || []).map(i => ({
      materialId: i.material_id,
      cantidad:   Number(i.cantidad),
    })),
  }
}
