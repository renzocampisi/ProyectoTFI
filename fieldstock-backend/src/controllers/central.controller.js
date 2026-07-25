// src/controllers/central.controller.js
/**
 * Lado RECEPTOR del panel multi-cliente — existe en TODO deploy:
 *   - `reportar`: recibe el reporte de una instancia-cliente (en la
 *     práctica, solo lo usa de verdad la instancia que actúa de central).
 *   - `accionLiberarDispositivo`: recibe una acción remota del panel
 *     central (en la práctica, la usa cualquier instancia-cliente).
 * Ninguno de los dos pasa por requireAuth — son llamadas instancia-a-
 * instancia, no de un usuario con sesión.
 */
import * as ClientesCentralesService from '../services/clientes-centrales.service.js'
import * as DispositivosService from '../services/dispositivos.service.js'

export async function reportar(req, res, next) {
  try {
    await ClientesCentralesService.registrarOActualizar(req.body, req.headers)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function accionLiberarDispositivo(req, res, next) {
  try {
    const { codigoQR } = req.body
    if (!codigoQR) {
      return res.status(400).json({ ok: false, error: 'codigoQR es obligatorio' })
    }
    // El panel central solo conoce el código impreso en la etiqueta del
    // dispositivo (el dueño se lo lee por teléfono) — nunca el id interno.
    const dispositivo = await DispositivosService.getByCodigoQR(codigoQR)
    const data = await DispositivosService.liberar(dispositivo.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
