// src/services/movimientos.service.js
import { supabase } from '../config/supabase.js'

export async function getByHerramienta(herramientaId) {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('herramienta_id', herramientaId)
    .order('fecha', { ascending: false })

  if (error) throw error
  return data
}

export async function create(herramientaId, body) {
  const TIPOS_VALIDOS = ['EGRESO','INGRESO','MANTENIMIENTO']
  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    const err = new Error(`Tipo de movimiento inválido: ${body.tipo}`)
    err.status = 400
    throw err
  }

  // Insertar movimiento
  const { data: movimiento, error: errMov } = await supabase
    .from('movimientos')
    .insert({
      herramienta_id: herramientaId,
      tipo:           body.tipo,
      fecha:          body.fecha        || new Date().toISOString().split('T')[0],
      obra:           body.obra         || null,
      responsable:    body.responsable,
      observacion:    body.observacion  || null,
    })
    .select()
    .single()

  if (errMov) throw errMov

  // Actualizar estado de la herramienta según tipo de movimiento
  const nuevoEstado = {
    EGRESO:        'EN_OBRA',
    INGRESO:       'DISPONIBLE',
    MANTENIMIENTO: 'EN_MANTENIMIENTO',
  }[body.tipo]

  await supabase
    .from('herramientas')
    .update({ estado: nuevoEstado })
    .eq('id', herramientaId)

  return movimiento
}
