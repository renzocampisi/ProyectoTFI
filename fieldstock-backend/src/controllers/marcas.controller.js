// src/controllers/marcas.controller.js
/**
 * Controllers de Marcas de herramientas.
 *
 * FIXME: igual que categorias.controller, este accede directo a Supabase
 * y además NO existe `marcas.service.js` para delegar. Acción recomendada:
 *   1. Crear `services/marcas.service.js` con getAll() y create(body).
 *   2. Reemplazar acá los accesos directos.
 * Diff esperado idéntico al de categorías (estructura espejada).
 */
import { supabase } from '../config/supabase.js'

export async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('marcas').select('*').order('nombre')
    if (error) throw error
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { nombre } = req.body
    if (!nombre?.trim())
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' })

    const { data, error } = await supabase
      .from('marcas')
      .insert({ nombre: nombre.trim() })
      .select().single()
    if (error) throw error
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
