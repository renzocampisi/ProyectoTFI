// src/controllers/panel.controller.js
/**
 * Controller del M1 Panel IA. Thin: valida body minimo y delega
 * en panel.service.
 *
 * Endpoints:
 *   POST /api/panel/chat
 *   body: { mensaje: string, historial?: Array<{ role, content }> }
 *   resp: { ok: true, data: { respuesta: string, traza: Array, imagenes?: string[], accionPendiente?: object } }
 *   (imagenes: URLs de fotos que alguna tool devolvió en el turno — ej. planos
 *   del historial de obra — el chat no interpreta markdown, se renderizan aparte)
 *
 *   POST /api/panel/ejecutar-accion
 *   body: { tool: string, args: object }  — viene de `accionPendiente` de /chat,
 *   se llama SOLO tras confirmación explícita del usuario en la UI.
 *   resp: { ok: true, data: { resumen: string, detalle: object } }
 */
import * as PanelService from '../services/panel.service.js'

export async function chat(req, res, next) {
  try {
    const { mensaje, historial } = req.body || {}
    const data = await PanelService.responder(mensaje, historial)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function ejecutarAccion(req, res, next) {
  try {
    const { tool, args } = req.body || {}
    const data = await PanelService.ejecutarAccion(tool, args)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
