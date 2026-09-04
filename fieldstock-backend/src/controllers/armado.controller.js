// src/controllers/armado.controller.js
/**
 * Controller de "Kits de Montaje" — armado de presupuestos/remitos por
 * descripción en lenguaje natural. Thin: toda la lógica vive en
 * armado.service.js.
 *
 *   POST /api/armado/interpretar  JSON { texto, destino }
 *                                 o multipart { texto, destino, foto? }
 *   POST /api/armado/confirmar    JSON { destino, obraId|obraNueva, lineas, proveedorId?, manoObra? }
 *                                 o multipart { payload: <el mismo objeto, JSON.stringify>, foto? } —
 *                                 el payload viaja serializado porque un campo multipart es
 *                                 siempre texto plano, no puede llevar el objeto anidado directo.
 */
import * as ArmadoService from '../services/armado.service.js'

export async function interpretar(req, res, next) {
  try {
    const { texto, destino } = req.body || {}
    // texto/destino llegan como string en ambos casos (JSON o multipart),
    // no hace falta normalizar tipos. req.file solo existe si vino una foto
    // adjunta — el middleware multer de la ruta no la exige.
    const foto = req.file ? { buffer: req.file.buffer, mimeType: req.file.mimetype } : undefined
    const data = await ArmadoService.interpretar({ texto, destino, foto })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function confirmar(req, res, next) {
  try {
    // Con foto, el payload viaja como multipart y llega serializado en el
    // campo `payload` (un campo multipart es siempre texto plano). Sin
    // foto sigue siendo JSON normal — req.body ya es el objeto.
    const payload = req.file ? JSON.parse(req.body.payload || '{}') : (req.body || {})
    if (req.file) payload.foto = { buffer: req.file.buffer, mimeType: req.file.mimetype }
    const data = await ArmadoService.confirmar(payload)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
