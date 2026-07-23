// src/controllers/planes.controller.js
import * as PlanesService from '../services/planes.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await PlanesService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
