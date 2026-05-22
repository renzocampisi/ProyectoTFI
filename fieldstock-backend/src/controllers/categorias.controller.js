// src/controllers/categorias.controller.js
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
