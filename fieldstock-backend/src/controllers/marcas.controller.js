// src/controllers/marcas.controller.js
/**
 * Controllers de Marcas de herramientas.
 * Patrón thin estándar — delega toda la lógica al service.
 */
import * as MarcasService from '../services/marcas.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await MarcasService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { nombre } = req.body
    if (!nombre?.trim())
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' })

    const data = await MarcasService.create(nombre)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
