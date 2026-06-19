// src/controllers/panel.controller.js
/**
 * Controller del M1 Panel IA. Thin: valida body minimo y delega
 * en panel.service.responder().
 *
 * Endpoint:
 *   POST /api/panel/chat
 *   body: { mensaje: string, historial?: Array<{ role, content }> }
 *   resp: { ok: true, data: { respuesta: string, traza: Array } }
 */
import * as PanelService from '../services/panel.service.js'

export async function chat(req, res, next) {
  try {
    const { mensaje, historial } = req.body || {}
    const data = await PanelService.responder(mensaje, historial)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
