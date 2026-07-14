// src/services/reservas.service.js
/**
 * Service de reservas de herramientas atadas a una obra con fecha.
 *
 * Separado a propósito de `herramientas.estado = 'RESERVADA'` (que es el
 * bloqueo transitorio de un remito en BORRADOR, ver remitos.service.js).
 * Esto es una reserva "a futuro": no cambia el estado de la herramienta,
 * es solo una anotación de planificación (ej. "esta soldadora va a hacer
 * falta en la obra X a partir del inicio").
 */
import { supabase } from '../config/supabase.js'

const SELECT = `
  id, herramienta_id, obra_id, fecha_reserva, created_at,
  herramienta:herramientas(id, nombre, codigo_qr, estado),
  obra:obras(id, nombre, fecha_inicio)
`

export async function listarPorHerramienta(herramientaId) {
  const { data, error } = await supabase
    .from('herramienta_reservas')
    .select(SELECT)
    .eq('herramienta_id', herramientaId)
    .order('fecha_reserva', { ascending: true })
  if (error) throw error
  return data
}

export async function listarPorObra(obraId) {
  const { data, error } = await supabase
    .from('herramienta_reservas')
    .select(SELECT)
    .eq('obra_id', obraId)
    .order('fecha_reserva', { ascending: true })
  if (error) throw error
  return data
}

export async function crear({ herramientaId, obraId, fechaReserva }) {
  if (!herramientaId || !obraId || !fechaReserva) {
    const err = new Error('herramientaId, obraId y fechaReserva son obligatorios')
    err.status = 400; throw err
  }

  const { data: herramienta, error: errH } = await supabase
    .from('herramientas').select('id, estado').eq('id', herramientaId).maybeSingle()
  if (errH) throw errH
  if (!herramienta) {
    const err = new Error('Herramienta no encontrada'); err.status = 404; throw err
  }
  if (herramienta.estado === 'BAJA') {
    const err = new Error('No se puede reservar una herramienta dada de baja')
    err.status = 400; throw err
  }

  const { data: obra, error: errO } = await supabase
    .from('obras').select('id').eq('id', obraId).maybeSingle()
  if (errO) throw errO
  if (!obra) {
    const err = new Error('Obra no encontrada'); err.status = 404; throw err
  }

  const { data, error } = await supabase
    .from('herramienta_reservas')
    .insert({ herramienta_id: herramientaId, obra_id: obraId, fecha_reserva: fechaReserva })
    .select(SELECT).single()
  if (error) throw error
  return data
}

export async function eliminar(id) {
  const { error } = await supabase.from('herramienta_reservas').delete().eq('id', id)
  if (error) throw error
}
