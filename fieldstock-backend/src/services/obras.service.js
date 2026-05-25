// src/services/obras.service.js
/**
 * Service del M4 — Obras (lugar físico donde van las herramientas).
 *
 * Las obras tienen un ciclo simple: ACTIVA ↔ FINALIZADA.
 * La vista `obras_resumen` precalcula los joins más comunes (cliente,
 * conteo de remitos, etc.) para evitar joins en el frontend.
 *
 * Nota: en la cabecera de un remito, la obra se referencia por NOMBRE
 * (string), no por UUID — ver getById() para el matching.
 */
import { supabase } from '../config/supabase.js'

export async function getAll({ estado, q } = {}) {
  let query = supabase
    .from('obras_resumen')
    .select('*')
    .order('fecha_inicio', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (q)      query = query.ilike('nombre', `%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Devuelve la obra + sus remitos ordenados.
 * Los remitos se matchean por NOMBRE de obra (la columna `remitos.obra`
 * guarda el nombre, no el UUID) — por eso necesitamos resolver primero
 * el nombre desde la tabla `obras`.
 */
export async function getById(id) {
  const { data: obra, error: errO } = await supabase
    .from('obras_resumen').select('*').eq('id', id).single()
  if (errO) throw errO

  // Resolver nombre para matchear los remitos (que guardan el nombre, no el UUID)
  const { data: obraBase } = await supabase
    .from('obras').select('nombre').eq('id', id).single()

  const { data: remitos } = await supabase
    .from('remitos_resumen')
    .select('*')
    .eq('obra', obraBase?.nombre)
    .order('fecha', { ascending: false })

  return { ...obra, remitos: remitos ?? [] }
}

export async function create(body) {
  const { data, error } = await supabase
    .from('obras')
    .insert({
      nombre:       body.nombre,
      direccion:    body.direccion,
      cliente:      body.cliente,
      fecha_inicio: body.fechaInicio,
      fecha_fin:    body.fechaFin    || null,
      estado:       'ACTIVA',
    })
    .select().single()

  if (error) throw error
  return data
}

export async function update(id, body) {
  const campos = {}
  if (body.nombre      !== undefined) campos.nombre       = body.nombre
  if (body.direccion   !== undefined) campos.direccion    = body.direccion
  if (body.cliente     !== undefined) campos.cliente      = body.cliente
  if (body.fechaInicio !== undefined) campos.fecha_inicio = body.fechaInicio
  if (body.fechaFin    !== undefined) campos.fecha_fin    = body.fechaFin || null

  if (!Object.keys(campos).length) {
    const err = new Error('No hay campos para actualizar')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('obras').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function finalizar(id) {
  const { data, error } = await supabase
    .from('obras')
    .update({ estado: 'FINALIZADA', fecha_fin: new Date().toISOString().split('T')[0] })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function reactivar(id) {
  const { data, error } = await supabase
    .from('obras')
    .update({ estado: 'ACTIVA', fecha_fin: null })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}
