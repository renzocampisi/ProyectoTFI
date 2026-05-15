// src/services/herramientas.service.js
import { supabase } from '../config/supabase.js'

function generarCodigoQR(nombre) {
  const ts       = Date.now().toString(36).toUpperCase()
  const iniciales = nombre.split(' ').filter(Boolean).slice(0, 3)
    .map(w => w[0].toUpperCase()).join('')
  return `FS-${iniciales || 'XX'}-${ts}`
}

export async function getAll({ estado, categoriaId, q, incluirBajas } = {}) {
  let query = supabase
    .from('herramientas_completas')
    .select('*')
    .order('created_at', { ascending: false })

  // Por defecto solo herramientas activas, salvo que se pida incluir bajas
  if (!incluirBajas) query = query.eq('activo', true)

  if (estado)      query = query.eq('estado', estado)
  if (categoriaId) query = query.eq('categoria_id', categoriaId)
  if (q)           query = query.ilike('nombre', `%${q}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('herramientas_completas')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function create(body) {
  const codigoQR = generarCodigoQR(body.nombre)

  const { data, error } = await supabase
    .from('herramientas')
    .insert({
      nombre:       body.nombre,
      categoria_id: body.categoriaId,
      marca:        body.marca        || null,
      modelo:       body.modelo       || null,
      numero_serie: body.numeroSerie  || null,
      descripcion:  body.descripcion  || null,
      anio_compra:  body.añoCompra    || null,
      valor:        body.valor        || null,
      estado:       'DISPONIBLE',
      codigo_qr:    codigoQR,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function update(id, body) {
  const campos = {}
  if (body.nombre      !== undefined) campos.nombre       = body.nombre
  if (body.categoriaId !== undefined) campos.categoria_id = body.categoriaId
  if (body.marca       !== undefined) campos.marca        = body.marca       || null
  if (body.modelo      !== undefined) campos.modelo       = body.modelo      || null
  if (body.numeroSerie !== undefined) campos.numero_serie = body.numeroSerie || null
  if (body.descripcion !== undefined) campos.descripcion  = body.descripcion || null
  if (body.añoCompra   !== undefined) campos.anio_compra  = body.añoCompra   || null
  if (body.valor       !== undefined) campos.valor        = body.valor       || null

  if (!Object.keys(campos).length) {
    const err = new Error('No hay campos para actualizar')
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('herramientas')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateEstado(id, estado) {
  const ESTADOS_VALIDOS = ['DISPONIBLE','EN_OBRA','EN_MANTENIMIENTO','RESERVADA','BAJA']
  if (!ESTADOS_VALIDOS.includes(estado)) {
    const err = new Error(`Estado inválido: ${estado}`)
    err.status = 400; throw err
  }

  const { data, error } = await supabase
    .from('herramientas')
    .update({ estado })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function darDeBaja(id, motivo) {
  const { data, error } = await supabase
    .rpc('dar_baja_herramienta', { p_id: id, p_motivo: motivo || null })

  if (error) throw error
  return data
}

export async function reactivar(id) {
  const { data, error } = await supabase
    .rpc('reactivar_herramienta', { p_id: id })

  if (error) throw error
  return data
}
