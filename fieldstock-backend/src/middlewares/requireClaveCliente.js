// src/middlewares/requireClaveCliente.js
/**
 * Autenticación instancia-a-instancia para el panel central multi-cliente
 * (ver architecture-multi-cliente.html) — separada por completo de
 * requireAuth, que es para sesiones de Supabase de personas.
 *
 * Valida el header `x-client-key` contra la client_key generada por ESTA
 * instancia (tabla instancia_central, fila única) — protege el endpoint
 * que recibe acciones remotas del panel central (ej. liberar un
 * dispositivo). No expone nada de esa tabla en la respuesta; solo permite
 * o rechaza el paso.
 */
import { supabase } from '../config/supabase.js'

export async function requireClaveCliente(req, res, next) {
  try {
    const clave = req.header('x-client-key')
    if (!clave) {
      return res.status(401).json({ ok: false, error: 'Falta x-client-key' })
    }

    const { data, error } = await supabase
      .from('instancia_central')
      .select('id')
      .eq('client_key', clave)
      .maybeSingle()
    if (error) throw error

    if (!data) {
      return res.status(401).json({ ok: false, error: 'Clave de instancia inválida' })
    }

    next()
  } catch (err) {
    next(err)
  }
}
