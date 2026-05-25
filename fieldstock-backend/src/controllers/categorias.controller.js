// src/controllers/categorias.controller.js
/**
 * Controllers de Categorías de herramientas.
 * Patrón thin estándar — delega toda la lógica al service.
 */
import * as CategoriasService from '../services/categorias.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await CategoriasService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { nombre } = req.body
    if (!nombre?.trim())
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' })

    const data = await CategoriasService.create(nombre)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
