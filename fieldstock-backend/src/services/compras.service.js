// src/services/compras.service.js
/**
 * Service del módulo Compras — Órdenes de Compra a proveedores.
 *
 * Modela el flujo: BORRADOR → CONFIRMADA → RECIBIDA_PARCIAL → RECIBIDA
 *                                    └→ CANCELADA (terminal)
 *
 * Side effects relevantes:
 *  · `materiales.stock_actual` — se incrementa via updateStock('reponer')
 *    cuando se RECIBE (parcial o total). NO descontamos al confirmar:
 *    el stock entra recién cuando físicamente llega.
 *  · `compras.total` — denormalizado, recalculado por trigger SQL
 *    `trg_compras_items_recalc` cada vez que cambia un item.
 *  · `compras.fecha_pedido`    — se setea al CONFIRMAR.
 *  · `compras.fecha_recepcion` — se setea al pasar a RECIBIDA total.
 *
 * Diseño:
 *  - Numero `OC-NNNNN` generado por RPC `generar_numero_compra`
 *    (espejo de remitos, ver migration `2026_06_07_create_compras.sql`).
 *  - Edición de cabecera e items solo en BORRADOR.
 *  - RECIBIDA es terminal: no se puede cancelar ni editar (sería rollback
 *    de stock — decisión contable que se evita explícitamente).
 *  - Sin transacciones: el SDK de Supabase no las expone para el patrón
 *    insert-y-detalle. Asumimos consistencia eventual igual que remitos.
 *
 * Nota: `movimientos` es exclusivo de herramientas (FK NOT NULL contra
 * `herramientas.id`), así que no insertamos un INGRESO_COMPRA por material.
 * El audit trail de stock vive en la propia compra (cantidad_recibida) +
 * en `compras` (estado/fecha_recepcion).
 */
import { supabase } from '../config/supabase.js'
import { updateStock } from './materiales.service.js'

// ── Helpers ───────────────────────────────────────────────────
async function generarNumero() {
  const { data, error } = await supabase.rpc('generar_numero_compra')
  if (error) throw error
  return data
}

const MEDIOS_PAGO_VALIDOS = new Set([
  'EFECTIVO','TRANSFERENCIA','CHEQUE','TARJETA','CUENTA_CORRIENTE'
])

function bad(msg, status = 400) {
  const err = new Error(msg)
  err.status = status
  return err
}

// ── Listar compras ────────────────────────────────────────────
// Devuelve cabeceras + proveedor (razon_social → `nombre`) + count de items.
// Hacemos dos queries: lista de compras y un map de counts por compra_id.
// (No conviene mezclar count y proveedor en un solo .select porque el SDK
//  no agrupa por relación parent — el join devolvería N filas si hubiera N items.)
export async function getAll({ estado, proveedorId, q } = {}) {
  let query = supabase
    .from('compras')
    .select('*, proveedor:proveedores(id, nombre)')
    .order('created_at', { ascending: false })

  if (estado)      query = query.eq('estado', estado)
  if (proveedorId) query = query.eq('proveedor_id', proveedorId)
  if (q)           query = query.ilike('numero', `%${q}%`)

  const { data: compras, error } = await query
  if (error) throw error

  if (!compras?.length) return []

  // Conteo de items por compra. Pedimos solo compra_id y agrupamos en JS.
  const ids = compras.map(c => c.id)
  const { data: items, error: errI } = await supabase
    .from('compras_items')
    .select('compra_id')
    .in('compra_id', ids)
  if (errI) throw errI

  const counts = new Map()
  for (const it of items ?? []) {
    counts.set(it.compra_id, (counts.get(it.compra_id) ?? 0) + 1)
  }

  return compras.map(c => ({
    ...c,
    proveedor_nombre: c.proveedor?.nombre ?? null,
    cantidad_items:   counts.get(c.id) ?? 0,
  }))
}

// ── Detalle ───────────────────────────────────────────────────
export async function getById(id) {
  const [
    { data: compra, error: errC },
    { data: items,  error: errI },
  ] = await Promise.all([
    supabase
      .from('compras')
      .select('*, proveedor:proveedores(id, nombre, cuit, telefono, email)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('compras_items')
      .select('*, material:materiales(id, nombre, unidad, stock_actual)')
      .eq('compra_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (errC) throw errC
  if (errI) throw errI
  if (!compra) return null

  return {
    ...compra,
    proveedor_nombre: compra.proveedor?.nombre ?? null,
    items: (items ?? []).map(it => ({
      ...it,
      material_nombre: it.material?.nombre ?? null,
      material_unidad: it.material?.unidad ?? null,
    })),
  }
}

// ── Crear compra ──────────────────────────────────────────────
// Acepta items opcionales en el body: si vienen, los inserta en cascada.
// Si alguno falla, eliminamos la cabecera para no dejar OC huérfanas.
export async function create(body) {
  if (!body?.proveedorId) throw bad('proveedorId es obligatorio')

  const medioPago = body.medioPago || 'EFECTIVO'
  if (!MEDIOS_PAGO_VALIDOS.has(medioPago)) {
    throw bad(`medioPago inválido: ${medioPago}`)
  }

  const numero = await generarNumero()

  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      numero,
      proveedor_id:  body.proveedorId,
      estado:        'BORRADOR',
      medio_pago:    medioPago,
      observaciones: body.observaciones || null,
    })
    .select().single()
  if (error) throw error

  const items = Array.isArray(body.items) ? body.items : []
  if (items.length) {
    try {
      for (const it of items) {
        await addItem(compra.id, it, { skipEstadoCheck: true })
      }
    } catch (err) {
      // Rollback manual: tiramos la compra recién creada para no dejar
      // OCs vacías o medio-cargadas si algún item falla la validación.
      await supabase.from('compras').delete().eq('id', compra.id)
      throw err
    }
  }

  // Re-leer para devolver el total ya recalculado por el trigger
  return await getById(compra.id)
}

// ── Editar cabecera ──────────────────────────────────────────
// Solo en BORRADOR. Campos editables: proveedor, medio_pago, observaciones.
export async function update(id, body) {
  const { data: compra, error: errC } = await supabase
    .from('compras').select('estado').eq('id', id).single()
  if (errC) throw errC

  if (compra.estado !== 'BORRADOR') {
    throw bad('Solo se pueden editar compras en estado BORRADOR')
  }

  const campos = {}
  if (body.proveedorId   !== undefined) campos.proveedor_id  = body.proveedorId
  if (body.medioPago     !== undefined) {
    if (!MEDIOS_PAGO_VALIDOS.has(body.medioPago)) {
      throw bad(`medioPago inválido: ${body.medioPago}`)
    }
    campos.medio_pago = body.medioPago
  }
  if (body.observaciones !== undefined) campos.observaciones = body.observaciones || null

  if (!Object.keys(campos).length) throw bad('No hay campos para actualizar')

  campos.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('compras').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Items: agregar ────────────────────────────────────────────
// `skipEstadoCheck` se usa internamente desde create() (la compra recién
// nacida está en BORRADOR por default, no hace falta releerla).
export async function addItem(compraId, body, { skipEstadoCheck = false } = {}) {
  if (!body?.materialId)       throw bad('materialId es obligatorio')
  const cantidad        = Number(body.cantidad)
  const precioUnitario  = Number(body.precioUnitario)
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw bad('cantidad debe ser un número mayor a 0')
  }
  if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
    throw bad('precioUnitario debe ser un número mayor o igual a 0')
  }

  if (!skipEstadoCheck) {
    const { data: compra, error: errC } = await supabase
      .from('compras').select('estado').eq('id', compraId).single()
    if (errC) throw errC
    if (compra.estado !== 'BORRADOR') {
      throw bad('Solo se pueden agregar items en estado BORRADOR')
    }
  }

  const { data, error } = await supabase
    .from('compras_items')
    .insert({
      compra_id:        compraId,
      material_id:      body.materialId,
      cantidad,
      precio_unitario:  precioUnitario,
    })
    .select().single()
  if (error) throw error
  return data
}

// ── Items: eliminar ───────────────────────────────────────────
export async function removeItem(compraId, itemId) {
  const { data: compra, error: errC } = await supabase
    .from('compras').select('estado').eq('id', compraId).single()
  if (errC) throw errC
  if (compra.estado !== 'BORRADOR') {
    throw bad('Solo se pueden quitar items en estado BORRADOR')
  }

  const { error } = await supabase
    .from('compras_items')
    .delete()
    .eq('id', itemId)
    .eq('compra_id', compraId)
  if (error) throw error
}

// ── Items: editar cantidad / precio ───────────────────────────
export async function updateItem(compraId, itemId, body) {
  const { data: compra, error: errC } = await supabase
    .from('compras').select('estado').eq('id', compraId).single()
  if (errC) throw errC
  if (compra.estado !== 'BORRADOR') {
    throw bad('Solo se pueden editar items en estado BORRADOR')
  }

  const campos = {}
  if (body.cantidad !== undefined) {
    const c = Number(body.cantidad)
    if (!Number.isFinite(c) || c <= 0) throw bad('cantidad debe ser > 0')
    campos.cantidad = c
  }
  if (body.precioUnitario !== undefined) {
    const p = Number(body.precioUnitario)
    if (!Number.isFinite(p) || p < 0) throw bad('precioUnitario debe ser >= 0')
    campos.precio_unitario = p
  }
  if (!Object.keys(campos).length) throw bad('No hay campos para actualizar')

  const { data, error } = await supabase
    .from('compras_items')
    .update(campos)
    .eq('id', itemId)
    .eq('compra_id', compraId)
    .select().single()
  if (error) throw error
  return data
}

// ── Avanzar estado: BORRADOR → CONFIRMADA ────────────────────
// La única transición manual hacia adelante (las demás son via recibir/
// cancelar). Setea `fecha_pedido` al avanzar.
export async function avanzarEstado(id) {
  const { data: compra, error: errC } = await supabase
    .from('compras').select('estado').eq('id', id).single()
  if (errC) throw errC

  if (compra.estado !== 'BORRADOR') {
    throw bad(`La compra está en estado ${compra.estado}, no se puede confirmar`)
  }

  // Validar que tenga al menos un item — una OC vacía no tiene sentido.
  const { data: items, error: errI } = await supabase
    .from('compras_items').select('id').eq('compra_id', id)
  if (errI) throw errI
  if (!items?.length) throw bad('La compra debe tener al menos un item')

  const { data, error } = await supabase
    .from('compras')
    .update({
      estado:       'CONFIRMADA',
      fecha_pedido: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

// ── Cancelar compra ──────────────────────────────────────────
// Terminal. Permitido en BORRADOR, CONFIRMADA y RECIBIDA_PARCIAL.
// NO permitido en RECIBIDA: el stock ya entró al inventario, deshacerlo
// sería un rollback contable que se prefiere evitar (decisión de producto).
// Si se cancela una compra RECIBIDA_PARCIAL, el stock que ya entró QUEDA
// — solo se cierra la posibilidad de recibir el resto.
export async function cancelar(id, motivo) {
  const { data: compra, error: errC } = await supabase
    .from('compras').select('estado, observaciones').eq('id', id).single()
  if (errC) throw errC

  if (compra.estado === 'RECIBIDA') {
    throw bad('No se puede cancelar una compra ya recibida totalmente')
  }
  if (compra.estado === 'CANCELADA') {
    throw bad('La compra ya está cancelada')
  }

  // Concatenamos el motivo a las observaciones existentes para preservar
  // contexto (en lugar de un campo `motivo_cancelacion` dedicado).
  const sufijo = motivo?.trim()
    ? `\n[CANCELADA] ${motivo.trim()}`
    : '\n[CANCELADA]'
  const nuevasObs = (compra.observaciones || '') + sufijo

  const { data, error } = await supabase
    .from('compras')
    .update({
      estado:        'CANCELADA',
      observaciones: nuevasObs,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

// ── Recibir mercadería ──────────────────────────────────────
// Body: { items: [{ itemId, cantidadRecibida }] }
// Para cada item, suma `(cantidadRecibida - cantidad_recibida_anterior)` al
// stock_actual del material. Si el delta es 0, no toca stock. Si es negativo,
// rechaza (no se admite "des-recibir").
//
// Después de actualizar items, recalcula el estado de la compra:
//   - Todos los items con cantidad_recibida === cantidad → RECIBIDA (+ fecha)
//   - Al menos uno con cantidad_recibida > 0 pero faltan → RECIBIDA_PARCIAL
//   - (No volvemos a CONFIRMADA — recibir nunca "destruye" progreso)
export async function recibir(id, body = {}) {
  const { data: compra, error: errC } = await supabase
    .from('compras').select('estado').eq('id', id).single()
  if (errC) throw errC
  if (!compra) throw bad('Compra no encontrada', 404)

  if (!['CONFIRMADA','RECIBIDA_PARCIAL'].includes(compra.estado)) {
    throw bad(`No se puede recibir una compra en estado ${compra.estado}`)
  }

  const itemsBody = Array.isArray(body.items) ? body.items : []
  if (!itemsBody.length) throw bad('No se enviaron items para recibir')

  // Leemos todos los items actuales de una para validar IDs y calcular deltas.
  const { data: itemsActuales, error: errI } = await supabase
    .from('compras_items')
    .select('id, material_id, cantidad, cantidad_recibida')
    .eq('compra_id', id)
  if (errI) throw errI

  const mapItems = new Map((itemsActuales ?? []).map(it => [it.id, it]))

  // Validación previa de TODOS los items antes de aplicar cambios — así
  // si uno es inválido, ninguno se procesa.
  for (const ib of itemsBody) {
    const actual = mapItems.get(ib.itemId)
    if (!actual) throw bad(`Item ${ib.itemId} no pertenece a la compra`)
    const nueva = Number(ib.cantidadRecibida)
    if (!Number.isFinite(nueva) || nueva < 0) {
      throw bad(`cantidadRecibida inválida para item ${ib.itemId}: ${ib.cantidadRecibida}`)
    }
    if (nueva > Number(actual.cantidad)) {
      throw bad(
        `cantidadRecibida (${nueva}) excede la cantidad pedida (${actual.cantidad}) ` +
        `del item ${ib.itemId}`,
        409
      )
    }
    if (nueva < Number(actual.cantidad_recibida)) {
      throw bad(
        `cantidadRecibida (${nueva}) es menor a lo ya recibido ` +
        `(${actual.cantidad_recibida}) en item ${ib.itemId}. No se admite des-recibir.`
      )
    }
  }

  // Aplicar: update del item + delta al stock del material.
  for (const ib of itemsBody) {
    const actual = mapItems.get(ib.itemId)
    const nueva  = Number(ib.cantidadRecibida)
    const delta  = nueva - Number(actual.cantidad_recibida)

    const { error: errU } = await supabase
      .from('compras_items')
      .update({ cantidad_recibida: nueva })
      .eq('id', ib.itemId)
      .eq('compra_id', id)
    if (errU) throw errU

    if (delta > 0) {
      await updateStock(actual.material_id, delta, 'reponer')
    }
    // Reflejar el cambio en el mapa por si necesitamos recalcular estado.
    actual.cantidad_recibida = nueva
  }

  // Re-leer todos los items para decidir el estado final (incluyendo los
  // que no vinieron en el body — pueden seguir incompletos).
  const { data: itemsFinales, error: errF } = await supabase
    .from('compras_items')
    .select('cantidad, cantidad_recibida')
    .eq('compra_id', id)
  if (errF) throw errF

  const todosCompletos = itemsFinales.every(
    it => Number(it.cantidad_recibida) >= Number(it.cantidad)
  )
  const algoRecibido = itemsFinales.some(
    it => Number(it.cantidad_recibida) > 0
  )

  const nuevoEstado = todosCompletos
    ? 'RECIBIDA'
    : algoRecibido
      ? 'RECIBIDA_PARCIAL'
      : compra.estado // sin cambios

  const campos = { estado: nuevoEstado, updated_at: new Date().toISOString() }
  if (todosCompletos) campos.fecha_recepcion = new Date().toISOString()

  const { data, error } = await supabase
    .from('compras').update(campos).eq('id', id).select().single()
  if (error) throw error

  return data
}

// ── Comprobante de pago ──────────────────────────────────────
// Almacenamiento: bucket privado `comprobantes-compras` (ver migration
// 2026_06_12_compras_comprobante_storage.sql). El path se guarda en
// `compras.comprobante_url`. El frontend nunca toca Storage directo —
// pasa por estas funciones que generan signed URLs temporales.

const BUCKET_COMPROBANTES = 'comprobantes-compras'
const SIGNED_URL_TTL_SEC  = 3600 // 1 hora — suficiente para abrir/descargar
const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024 // 5 MiB (matchea bucket)
const MIMES_COMPROBANTE = new Set(['application/pdf', 'image/jpeg', 'image/png'])

function extDeMime(mime) {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/jpeg')      return 'jpg'
  if (mime === 'image/png')       return 'png'
  return 'bin'
}

// Devuelve { url, path, expiresIn } o null si la compra no tiene comprobante.
export async function getComprobanteSignedUrl(id) {
  const { data: compra, error } = await supabase
    .from('compras').select('comprobante_url').eq('id', id).single()
  if (error) throw error
  if (!compra?.comprobante_url) return null

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .createSignedUrl(compra.comprobante_url, SIGNED_URL_TTL_SEC)
  if (signErr) throw signErr

  return { url: data.signedUrl, path: compra.comprobante_url, expiresIn: SIGNED_URL_TTL_SEC }
}

// Sube el comprobante. Si ya existía uno, lo reemplaza (borra el viejo del
// bucket antes de subir el nuevo para no acumular huérfanos).
export async function setComprobante(id, { buffer, mimetype }) {
  if (!buffer || buffer.length === 0) throw bad('Archivo vacío')
  if (buffer.length > MAX_COMPROBANTE_BYTES) throw bad('Archivo supera 5 MB')
  if (!MIMES_COMPROBANTE.has(mimetype)) {
    throw bad(`Tipo no permitido: ${mimetype}. Use PDF, JPG o PNG.`)
  }

  const { data: compra, error: errC } = await supabase
    .from('compras').select('numero, comprobante_url').eq('id', id).single()
  if (errC) throw errC
  if (!compra) throw bad('Compra no encontrada', 404)

  const path = `${compra.numero}-${Date.now()}.${extDeMime(mimetype)}`

  if (compra.comprobante_url) {
    // best-effort: si falla el delete del viejo no bloqueamos la subida
    await supabase.storage.from(BUCKET_COMPROBANTES)
      .remove([compra.comprobante_url]).catch(() => {})
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, buffer, { contentType: mimetype, upsert: false })
  if (upErr) throw upErr

  const { data, error: updErr } = await supabase
    .from('compras').update({ comprobante_url: path }).eq('id', id)
    .select().single()
  if (updErr) throw updErr
  return data
}

export async function removeComprobante(id) {
  const { data: compra, error } = await supabase
    .from('compras').select('comprobante_url').eq('id', id).single()
  if (error) throw error
  if (!compra?.comprobante_url) return null

  await supabase.storage.from(BUCKET_COMPROBANTES)
    .remove([compra.comprobante_url]).catch(() => {})

  const { data, error: updErr } = await supabase
    .from('compras').update({ comprobante_url: null }).eq('id', id)
    .select().single()
  if (updErr) throw updErr
  return data
}
