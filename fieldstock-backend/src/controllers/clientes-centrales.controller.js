// src/controllers/clientes-centrales.controller.js
/**
 * Lado EMISOR del panel multi-cliente — con sesión normal de ADMIN. Lee
 * el registro de clientes reportados y dispara acciones remotas sobre
 * uno puntual.
 */
import * as ClientesCentralesService from '../services/clientes-centrales.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await ClientesCentralesService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function liberarDispositivo(req, res, next) {
  try {
    const { codigoQR } = req.body
    if (!codigoQR) {
      return res.status(400).json({ ok: false, error: 'codigoQR es obligatorio' })
    }
    const data = await ClientesCentralesService.liberarDispositivoRemoto(req.params.clienteId, codigoQR)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
