// src/controllers/movimientos.controller.js
/**
 * Controllers de Movimientos (log inmutable de trazabilidad).
 * Solo dos operaciones: leer historial de una herramienta y crear un
 * movimiento nuevo. NO hay update ni delete por invariante del dominio
 * (ver movimientos.service.js).
 *
 * `:id` en las rutas refiere a la herramienta, no al movimiento — los
 * movimientos siempre se consultan/crean en el contexto de su herramienta.
 */
import * as MovimientosService from '../services/movimientos.service.js'

export async function getByHerramienta(req, res, next) {
  try {
    const data = await MovimientosService.getByHerramienta(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { tipo, responsable } = req.body
    if (!tipo || !responsable) {
      return res.status(400).json({ ok: false, error: 'tipo y responsable son obligatorios' })
    }
    const data = await MovimientosService.create(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
