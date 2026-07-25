// src/controllers/dispositivos.controller.js
import * as DispositivosService from '../services/dispositivos.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await DispositivosService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function crear(req, res, next) {
  try {
    const { codigoQR, imeiProveedor } = req.body
    const data = await DispositivosService.crear({ codigoQR, imeiProveedor })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function emparejar(req, res, next) {
  try {
    const { codigoQR, herramientaId } = req.body
    if (!codigoQR) {
      return res.status(400).json({ ok: false, error: 'codigoQR es obligatorio' })
    }
    const data = await DispositivosService.emparejar({ codigoQR, herramientaId })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function liberar(req, res, next) {
  try {
    const data = await DispositivosService.liberar(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function darDeBaja(req, res, next) {
  try {
    const data = await DispositivosService.darDeBaja(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
