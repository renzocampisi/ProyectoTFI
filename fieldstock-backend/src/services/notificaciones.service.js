// src/services/notificaciones.service.js
/**
 * Service de Notificaciones.
 *
 * Bandeja simple de eventos para el usuario. Las notificaciones se crean
 * desde el backend (típicamente cuando avanza un remito) o desde el
 * scheduler de vencimientos de mantenimiento.
 *
 * `getAll` retorna las últimas 50 con el remito asociado (si existe)
 * precargado vía el join `remitos(numero, obra)`.
 */
import { supabase } from '../config/supabase.js'

export async function getAll({ soloNoLeidas = false } = {}) {
  let query = supabase
    .from('notificaciones')
    .select('*, remitos(numero, obra)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (soloNoLeidas) query = query.eq('leida', false)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function create(body) {
  const { data, error } = await supabase
    .from('notificaciones')
    .insert({
      tipo:      body.tipo      || 'INFO',
      titulo:    body.titulo,
      mensaje:   body.mensaje,
      remito_id: body.remitoId  || null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function marcarLeida(id) {
  const { data, error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function marcarTodasLeidas() {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('leida', false)
  if (error) throw error
}
