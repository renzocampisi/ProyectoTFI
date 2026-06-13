// src/controllers/compras.controller.js
/**
 * Controllers del módulo Compras. Thin: solo req/res, validación mínima
 * de body y delegación al service.
 */
import * as ComprasService from '../services/compras.service.js'

export async function getAll(req, res, next) {
  try {
    const { estado, proveedorId, q } = req.query
    const data = await ComprasService.getAll({ estado, proveedorId, q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await ComprasService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Compra no encontrada' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { proveedorId } = req.body || {}
    if (!proveedorId) {
      return res.status(400).json({ ok: false, error: 'proveedorId es obligatorio' })
    }
    const data = await ComprasService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await ComprasService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function avanzarEstado(req, res, next) {
  try {
    const data = await ComprasService.avanzarEstado(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function cancelar(req, res, next) {
  try {
    const { motivo } = req.body || {}
    const data = await ComprasService.cancelar(req.params.id, motivo)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function recibir(req, res, next) {
  try {
    const data = await ComprasService.recibir(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// ── Items ─────────────────────────────────────────────────────
export async function addItem(req, res, next) {
  try {
    const { materialId, cantidad, precioUnitario } = req.body || {}
    if (!materialId) {
      return res.status(400).json({ ok: false, error: 'materialId es obligatorio' })
    }
    if (cantidad === undefined || precioUnitario === undefined) {
      return res.status(400).json({ ok: false, error: 'cantidad y precioUnitario son obligatorios' })
    }
    const data = await ComprasService.addItem(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function removeItem(req, res, next) {
  try {
    await ComprasService.removeItem(req.params.id, req.params.itemId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function updateItem(req, res, next) {
  try {
    const data = await ComprasService.updateItem(req.params.id, req.params.itemId, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// ── Comprobante de pago ───────────────────────────────────────
// GET devuelve { url, path, expiresIn } o 404 si la compra no tiene
// comprobante asignado todavía. El frontend usa esa url para mostrar/
// descargar el archivo desde el bucket privado.
export async function getComprobante(req, res, next) {
  try {
    const data = await ComprasService.getComprobanteSignedUrl(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Esta compra no tiene comprobante' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// POST espera multipart/form-data con field `archivo`. El middleware multer
// (montado en la ruta) deja el buffer en req.file. Acá solo delegamos al
// service que valida tipo, tamaño y sube a Storage.
export async function uploadComprobante(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Falta archivo (field: archivo)' })
    const data = await ComprasService.setComprobante(req.params.id, {
      buffer:   req.file.buffer,
      mimetype: req.file.mimetype,
    })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function deleteComprobante(req, res, next) {
  try {
    await ComprasService.removeComprobante(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
