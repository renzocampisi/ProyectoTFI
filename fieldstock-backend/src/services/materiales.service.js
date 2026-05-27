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
 * TODO: validar que no haya movimientos/remitos no-cerrados con este
 * material antes de eliminar (similar a remitos.eliminar que chequea
 * herramientas EN_OBRA). Por ahora dejamos al usuario la decisión via
 * el confirm dialog del frontend.
 */
export async function remove(id) {
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
