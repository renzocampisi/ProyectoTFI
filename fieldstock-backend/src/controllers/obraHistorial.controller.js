// src/controllers/obraHistorial.controller.js
/**
 * Controller de Historial de Obra. Thin: toda la lógica vive en
 * obraHistorial.service.js.
 *
 *   GET /api/obras/:id/historial
 */
import * as ObraHistorial from '../services/obraHistorial.service.js'

export async function getHistorial(req, res, next) {
  try {
    const data = await ObraHistorial.getHistorial(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
