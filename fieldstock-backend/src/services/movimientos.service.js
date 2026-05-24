// src/services/movimientos.service.js
/**
 * Service de Movimientos de inventario (log de trazabilidad).
 *
 * INVARIANTE DEL DOMINIO: los movimientos son INMUTABLES.
 * - No hay update ni delete por diseño.
 * - Cada movimiento es la fuente de verdad de un cambio de estado de una
 *   herramienta en un momento dado.
 *
 * Al crear un movimiento se actualiza también el estado de la herramienta
 * según la tabla de mapeo abajo. Es un side-effect intencional para mantener
 * el estado de la herramienta sincronizado con su último movimiento.
 */
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

  // Mapeo tipo de movimiento → estado resultante de la herramienta.
  // EGRESO sale a obra, INGRESO vuelve disponible, MANTENIMIENTO la bloquea.
  // Si el tipo no está en este mapa, nuevoEstado queda undefined y la
  // actualización falla silenciosamente — la validación arriba garantiza
  // que solo lleguen los 3 tipos válidos.
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
