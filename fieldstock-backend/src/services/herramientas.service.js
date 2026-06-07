// src/services/herramientas.service.js
/**
 * Service del M2 — Inventario de Herramientas.
 *
 * Estados válidos del dominio:
 *   DISPONIBLE | EN_OBRA | EN_MANTENIMIENTO | RESERVADA | BAJA
 *
 * Reglas:
 * - BAJA es terminal y solo se aplica via la RPC `dar_baja_herramienta`.
 * - Para volver desde BAJA se usa la RPC `reactivar_herramienta`.
 * - EN_MANTENIMIENTO bloquea asignación a remitos (regla validada en addItem
 *   de remitos.service.js, no acá).
 *
 * Cobertura de tests: ver herramientas.service.test.js (27 casos).
 */
import { supabase } from '../config/supabase.js'

/**
 * Genera el código QR inmutable de una herramienta.
 * Formato: FS-{INICIALES_NOMBRE}-{TIMESTAMP_BASE36}
 *   - Las iniciales son las primeras letras de las hasta 3 primeras palabras.
 *   - Si el nombre está vacío, se usa "XX" como fallback.
 * El timestamp en base36 + las iniciales hacen prácticamente imposible
 * colisionar dos códigos generados en momentos distintos.
 */
function generarCodigoQR(nombre) {
  const ts       = Date.now().toString(36).toUpperCase()
  const iniciales = nombre.split(' ').filter(Boolean).slice(0, 3)
    .map(w => w[0].toUpperCase()).join('')
  return `FS-${iniciales || 'XX'}-${ts}`
}

export async function getAll({ estado, categoriaId, q, codigoQR } = {}) {
  let query = supabase
    .from('herramientas_completas')
    .select('*')
    .order('created_at', { ascending: false })

  if (estado)      query = query.eq('estado', estado)
  if (categoriaId) query = query.eq('categoria_id', categoriaId)
  if (q)           query = query.ilike('nombre', `%${q}%`)
  if (codigoQR)    query = query.ilike('codigo_qr', `%${codigoQR}%`)

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
      anio_compra:  body.anioCompra   || null,
      valor:        body.valor        || null,
      divisa:       body.divisa       || 'ARS',
      estado:       body.estadoInicial || 'DISPONIBLE',
      importante:   body.importante === true,
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
  if (body.numeroSerie !== undefined) campos.numero_serie = body.numeroSerie  || null
  if (body.descripcion !== undefined) campos.descripcion  = body.descripcion  || null
  if (body.anioCompra  !== undefined) campos.anio_compra  = body.anioCompra   || null
  if (body.valor       !== undefined) campos.valor        = body.valor        || null
  if (body.divisa      !== undefined) campos.divisa       = body.divisa       || 'ARS'
  if (body.importante  !== undefined) campos.importante   = body.importante === true

  const { data, error } = await supabase
    .from('herramientas').update(campos).eq('id', id).select().single()
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
    .from('herramientas').update({ estado }).eq('id', id).select().single()
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
