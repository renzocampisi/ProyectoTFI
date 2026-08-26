// src/controllers/armado.controller.js
/**
 * Controller de "Kits de Montaje" — armado de presupuestos/remitos por
 * descripción en lenguaje natural. Thin: toda la lógica vive en
 * armado.service.js.
 *
 *   POST /api/armado/interpretar  body: { texto, destino }
 *   POST /api/armado/confirmar    body: { destino, obraId|obraNueva, lineas, proveedorId? }
 */
import * as ArmadoService from '../services/armado.service.js'

export async function interpretar(req, res, next) {
  try {
    const { texto, destino } = req.body || {}
    const data = await ArmadoService.interpretar({ texto, destino })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function confirmar(req, res, next) {
  try {
    const data = await ArmadoService.confirmar(req.body || {})
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
