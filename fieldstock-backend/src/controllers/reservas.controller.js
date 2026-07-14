// src/controllers/reservas.controller.js
/**
 * Controllers de reservas de herramientas (reserva a futuro atada a una
 * obra + fecha). Patrón thin estándar — lógica en reservas.service.js.
 *
 * `:id` en las rutas de herramienta/obra refiere a la herramienta u obra
 * dueña de la reserva; `:reservaId` refiere a la reserva en sí (solo en
 * la ruta de eliminar).
 */
import * as ReservasService from '../services/reservas.service.js'

export async function listarPorHerramienta(req, res, next) {
  try {
    const data = await ReservasService.listarPorHerramienta(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function listarPorObra(req, res, next) {
  try {
    const data = await ReservasService.listarPorObra(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function crear(req, res, next) {
  try {
    const data = await ReservasService.crear({
      herramientaId: req.params.id,
      obraId:        req.body.obraId,
      fechaReserva:  req.body.fechaReserva,
    })
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function eliminar(req, res, next) {
  try {
    await ReservasService.eliminar(req.params.reservaId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
