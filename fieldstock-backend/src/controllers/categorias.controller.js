// src/controllers/categorias.controller.js
import * as CategoriasService from '../services/categorias.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await CategoriasService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
