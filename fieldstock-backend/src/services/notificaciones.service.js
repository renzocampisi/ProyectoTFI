// src/services/notificaciones.service.js
/**
 * Service de Notificaciones.
 *
 * Bandeja simple de eventos para el usuario. Las notificaciones se crean
 * desde el backend (típicamente cuando avanza un remito), desde el
 * trigger SQL de stock bajo en materiales, o desde el scheduler de
 * vencimientos de mantenimiento.
 *
 * `getAll` retorna las últimas 15 con el remito o material asociado
 * precargado vía los joins. El límite se eligió para que la campanita
 * muestre solo las notifs recientes (decisión del dueño: 10-15 para no
 * abrumar con historial viejo).
 *
 * Cada notif puede tener remito_id (PROBLEMA_LLEGADA, INFO de remito),
 * material_id (STOCK_BAJO, issue #51 parte 2) o ninguno (INFO genérica).
 * Si la FK queda null por ON DELETE SET NULL es porque la entidad fue
 * eliminada — el frontend marca esas notifs como huérfanas (PR #54).
 */
import { supabase } from '../config/supabase.js'

export async function getAll({ soloNoLeidas = false } = {}) {
  let query = supabase
    .from('notificaciones')
    .select('*, remitos(numero, obra), material:materiales(id, nombre)')
    .order('created_at', { ascending: false })
    .limit(15)

  if (soloNoLeidas) query = query.eq('leida', false)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function create(body) {
  const { data, error } = await supabase
    .from('notificaciones')
    .insert({
      tipo:        body.tipo      || 'INFO',
      titulo:      body.titulo,
      mensaje:     body.mensaje,
      remito_id:   body.remitoId   || null,
      material_id: body.materialId || null,
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
