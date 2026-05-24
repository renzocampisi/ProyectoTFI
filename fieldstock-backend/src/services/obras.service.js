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
 *
 * FIXME: La primera query del Promise.all busca remitos por `obra` igualando
 * al UUID. Esa columna en `remitos` guarda el NOMBRE (no el UUID), por lo
 * que esa query siempre devuelve [] y su resultado se descarta. Es un
 * round-trip a Supabase muerto que sobrevive desde un refactor previo.
 * Acción sugerida: borrar la línea `supabase.from('remitos_resumen')...eq('obra', id)`
 * del Promise.all y la variable `remitos` que no se usa.
 */
export async function getById(id) {
  const [
    { data: obra,     error: errO },
    { data: remitos,  error: errR },  // ← se calcula pero no se usa (ver FIXME)
  ] = await Promise.all([
    supabase.from('obras_resumen').select('*').eq('id', id).single(),
    supabase.from('remitos_resumen').select('*').eq('obra', id),
  ])

  if (errO) throw errO
  if (errR) throw errR

  // Esta es la query real: matcheamos remitos por nombre de obra
  const { data: obra2 } = await supabase
    .from('obras').select('nombre').eq('id', id).single()

  const { data: remitosObra } = await supabase
    .from('remitos_resumen')
    .select('*')
    .eq('obra', obra2?.nombre)
    .order('fecha', { ascending: false })

  return { ...obra, remitos: remitosObra ?? [] }
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
