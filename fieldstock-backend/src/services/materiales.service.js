// src/services/materiales.service.js
/**
 * Service del M6 — Materiales (consumibles del stock).
 *
 * A diferencia de Herramientas (cada unidad es única e identificable por QR),
 * los Materiales son fungibles: se trackea solo `stock_actual` y `stock_minimo`.
 *
 * La función updateStock() es el único punto que modifica stock — la llaman
 * remitos.service.js al avanzar/volver de estados de remito. NO exponer
 * updateStock vía router: es de uso interno entre services.
 *
 * El borrado es soft (campo `activo = false`).
 */
import { supabase } from '../config/supabase.js'

export async function getAll({ q } = {}) {
  let query = supabase
    .from('materiales')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  if (q) query = query.ilike('nombre', `%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('materiales').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Devuelve la lista de marcas únicas ya usadas en el catálogo (Word #17).
 * Sirve para autocomplete del input "Marca" en el formulario de alta/edición
 * de materiales — evita typos y agrupa materiales con la misma marca.
 *
 * Filtramos nulls y strings vacíos en SQL; ordenamos alfabéticamente para
 * facilitar lectura.
 */
export async function getMarcas() {
  const { data, error } = await supabase
    .from('materiales')
    .select('marca')
    .not('marca', 'is', null)
    .neq('marca', '')
    .order('marca')

  if (error) throw error
  // Dedup en JS — Supabase no tiene DISTINCT en el JS SDK
  return [...new Set((data ?? []).map(r => r.marca))]
}

/**
 * Busca un material existente que tenga el mismo nombre + marca (case-insensitive,
 * trimmed). Si existe, lo devuelve; si no, devuelve null. Usado por el frontend
 * antes de crear para detectar duplicados (Word: "redundancia de datos") y
 * ofrecerle al usuario sumar stock al existente en vez de duplicar la fila.
 *
 * Comparamos por nombre + marca porque dos materiales con el mismo nombre pero
 * marca distinta son materiales distintos legítimos (ej. "Bulones M12" Tacsa vs
 * "Bulones M12" Roda). La unidad NO se compara — si difieren, mostramos ambas
 * en el modal del frontend para que el usuario decida.
 *
 * Solo considera materiales con activo=true. Un material soft-deleted con el
 * mismo nombre no cuenta como duplicado (el sistema lo considera "borrado").
 */
export async function findDuplicate({ nombre, marca }) {
  if (!nombre?.trim()) return null

  const nombreNorm = nombre.trim().toLowerCase()
  const marcaNorm  = marca?.trim().toLowerCase() || null

  const { data, error } = await supabase
    .from('materiales')
    .select('*')
    .eq('activo', true)
    .ilike('nombre', nombreNorm)
  if (error) throw error

  // ilike es case-insensitive pero no normaliza whitespace. Filtramos en JS
  // para asegurar match exacto sobre nombre+marca normalizados.
  return (data ?? []).find(m => {
    const mNombre = m.nombre?.trim().toLowerCase()
    const mMarca  = m.marca?.trim().toLowerCase() || null
    return mNombre === nombreNorm && mMarca === marcaNorm
  }) || null
}

export async function create(body) {
  const { data, error } = await supabase
    .from('materiales')
    .insert({
      nombre:       body.nombre,
      descripcion:  body.descripcion  || null,
      // Marca opcional (Word #17). Si viene vacía o whitespace, guardamos null
      // y la UI lo muestra como "Sin marca" para mantener consistencia.
      marca:        body.marca?.trim() || null,
      unidad:       body.unidad       || 'unidad',
      stock_actual: body.stockActual  || 0,
      stock_minimo: body.stockMinimo  || 0,
    })
    .select().single()
  if (error) throw error
  return data
}

/**
 * Suma una cantidad al stock_actual de un material existente. Usado por el
 * flow de "agregar stock" desde el form de nuevo material cuando se detecta
 * un duplicado y el usuario elige sumar al existente.
 *
 * Es un wrapper sobre updateStock con operación 'reponer', expuesto vía HTTP
 * porque acá sí queremos un endpoint público (a diferencia del updateStock
 * interno que solo lo llama remitos.service).
 */
export async function agregarStock(id, cantidad) {
  const num = Number(cantidad)
  if (!Number.isFinite(num) || num <= 0) {
    const err = new Error('La cantidad a sumar debe ser un número mayor a 0')
    err.status = 400; throw err
  }
  return updateStock(id, num, 'reponer')
}

export async function update(id, body) {
  const campos = {}
  if (body.nombre      !== undefined) campos.nombre       = body.nombre
  if (body.descripcion !== undefined) campos.descripcion  = body.descripcion || null
  if (body.marca       !== undefined) campos.marca        = body.marca?.trim() || null
  if (body.unidad      !== undefined) campos.unidad       = body.unidad
  if (body.stockActual !== undefined) campos.stock_actual = body.stockActual
  if (body.stockMinimo !== undefined) campos.stock_minimo = body.stockMinimo

  if (!Object.keys(campos).length) {
    const err = new Error('No hay campos para actualizar')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('materiales')
    .update(campos)
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

/**
 * Soft delete del material: solo marca `activo = false`. La fila queda en
 * la DB para preservar la integridad referencial con remitos viejos que
 * la usen (un remito CERRADO con materiales eliminados sigue siendo
 * auditable).
 *
 * getAll() ya filtra por `activo = true` así que el material desaparece
 * de la lista. Si se quiere "recuperar" un material eliminado, hoy hay
 * que hacer un UPDATE manual desde el dashboard de Supabase.
 *
 * Pre-check (issue #49): bloquea la baja si el material está siendo usado
 * en algún remito abierto (cualquier estado distinto de CERRADO). Sino, el
 * `remito_materiales_completo` que lee la vista de detalle del remito
 * mostraría datos huérfanos cuando el join contra `materiales` se rompiera
 * por el filtro de `activo`. Mismo patrón que `remitos.eliminar()` para
 * herramientas EN_OBRA.
 */
export async function remove(id) {
  // Contar referencias en remitos NO cerrados. Usamos un select con join
  // implícito vía relación FK (`remitos!inner(estado)`) para filtrar por
  // estado del remito padre. `count: 'exact'` + `head: true` evita traer
  // las filas — solo necesitamos el número.
  const { count, error: errCount } = await supabase
    .from('remito_materiales')
    .select('id, remitos!inner(estado)', { count: 'exact', head: true })
    .eq('material_id', id)
    .neq('remitos.estado', 'CERRADO')

  if (errCount) throw errCount

  if (count && count > 0) {
    const err = new Error(
      `No se puede eliminar: el material está en uso en ${count} remito(s) abierto(s). Cerralos primero.`
    )
    err.status = 409
    throw err
  }

  const { error } = await supabase
    .from('materiales')
    .update({ activo: false })
    .eq('id', id)

  if (error) throw error
}

/**
 * Aplica un delta de stock al material. Operación 'descontar' resta,
 * 'reponer' suma. Falla con status 400 si el resultado quedaría negativo.
 * Uso interno desde remitos.service.js — NO exponer vía endpoint HTTP.
 */
export async function updateStock(id, cantidad, operacion = 'descontar') {
  const { data: mat, error: errM } = await supabase
    .from('materiales').select('stock_actual').eq('id', id).single()
  if (errM) throw errM

  const nuevoStock = operacion === 'descontar'
    ? mat.stock_actual - cantidad
    : mat.stock_actual + cantidad

  if (nuevoStock < 0) {
    const err = new Error(`Stock insuficiente. Disponible: ${mat.stock_actual}`)
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('materiales')
    .update({ stock_actual: nuevoStock })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Precio de referencia ──────────────────────────────────────
// Devuelve el precio_unitario de la ULTIMA compra registrada para ese
// material (la mas reciente por fecha_recepcion, fallback created_at).
// Si nunca se compro, cae al campo `precio_referencia` de la tabla
// `materiales` (precio orientativo cargado a mano). Si tampoco hay
// precio_referencia, devuelve null (el operador escribe a mano en el
// form de Presupuestos).
//
// Orden de prioridad:
//   1. Ultima compra real (fuente: 'ultima_compra')
//   2. precio_referencia de la tabla (fuente: 'referencia_material')
//   3. null
export async function getPrecioReferencia(materialId) {
  const { data, error } = await supabase
    .from('compras_items')
    .select('precio_unitario, compra:compras(fecha_recepcion, created_at)')
    .eq('material_id', materialId)
    .order('created_at', { ascending: false })
    .limit(20)  // tomamos las ultimas 20 y elegimos en JS la mas reciente por fecha
  if (error) throw error

  if (data?.length) {
    // Ordenar por fecha_recepcion (cuando llegó) desc, fallback created_at
    const sorted = [...data].sort((a, b) => {
      const fa = a.compra?.fecha_recepcion || a.compra?.created_at || ''
      const fb = b.compra?.fecha_recepcion || b.compra?.created_at || ''
      return fb.localeCompare(fa)
    })
    return { precio: Number(sorted[0].precio_unitario), fuente: 'ultima_compra' }
  }

  // Fallback: precio orientativo cargado en la ficha del material.
  const { data: mat, error: errMat } = await supabase
    .from('materiales').select('precio_referencia').eq('id', materialId).maybeSingle()
  if (errMat) throw errMat
  const precioRef = Number(mat?.precio_referencia) || 0
  if (precioRef > 0) {
    return { precio: precioRef, fuente: 'referencia_material' }
  }
  return null
}
