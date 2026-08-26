// src/controllers/scanMatch.controller.js
/**
 * Controller de "Scan & Match" (remitos de proveedores). Thin: toda la
 * lógica vive en scanMatch.service.js.
 *
 *   POST /api/compras/:id/scan-match           multipart, field `archivo`
 *   POST /api/compras/:id/scan-match/confirmar body: { items: [...] }
 */
import * as ScanMatchService from '../services/scanMatch.service.js'

export async function proponer(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Falta archivo (field: archivo)' })
    const data = await ScanMatchService.proponer(req.params.id, {
      buffer:   req.file.buffer,
      mimeType: req.file.mimetype,
    })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function confirmar(req, res, next) {
  try {
    const { items } = req.body || {}
    const data = await ScanMatchService.confirmar(req.params.id, items)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
