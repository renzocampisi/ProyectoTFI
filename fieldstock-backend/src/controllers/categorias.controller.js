// src/controllers/categorias.controller.js
/**
 * Controllers de Categorías de herramientas.
 *
 * FIXME: este controller accede directo a Supabase, rompiendo el patrón
 * controller→service del proyecto. Existe `categorias.service.js` pero
 * solo expone `getAll()`. Acción recomendada:
 *   1. Mover el SELECT del getAll de acá al service existente (ya hecho ahí).
 *   2. Agregar `create(body)` al service.
 *   3. Reemplazar los accesos directos a `supabase` por llamadas al service.
 * Riesgo: bajo — la lógica es CRUD simple y hay tests cubriendo el patrón.
 */
import { supabase } from '../config/supabase.js'

export async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('categorias').select('*').order('nombre')
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
      .from('categorias')
      .insert({ nombre: nombre.trim() })
      .select().single()
    if (error) throw error
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
