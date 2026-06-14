// src/controllers/presupuestos.controller.js
/**
 * Controllers del módulo Presupuestos. Thin: solo req/res, validación
 * mínima de body y delegación al service.
 */
import multer from 'multer'
import * as PresupuestosService from '../services/presupuestos.service.js'

// Multer para PDF (memoryStorage, max 5 MiB, matchea el bucket).
export const uploadPdfMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('archivo')

export async function getAll(req, res, next) {
  try {
    const { obraId, estado } = req.query
    const data = await PresupuestosService.getAll({ obraId, estado })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await PresupuestosService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Presupuesto no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const data = await PresupuestosService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await PresupuestosService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    await PresupuestosService.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ── Insumos ─────────────────────────────────────────────────
export async function addInsumo(req, res, next) {
  try {
    const data = await PresupuestosService.addInsumo(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function updateInsumo(req, res, next) {
  try {
    const data = await PresupuestosService.updateInsumo(req.params.id, req.params.insumoId, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function removeInsumo(req, res, next) {
  try {
    await PresupuestosService.removeInsumo(req.params.id, req.params.insumoId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ── Costos extra ────────────────────────────────────────────
export async function addCosto(req, res, next) {
  try {
    const data = await PresupuestosService.addCosto(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function updateCosto(req, res, next) {
  try {
    const data = await PresupuestosService.updateCosto(req.params.id, req.params.costoId, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function removeCosto(req, res, next) {
  try {
    await PresupuestosService.removeCosto(req.params.id, req.params.costoId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ── Transiciones de estado ──────────────────────────────────
export async function enviarAprobacion(req, res, next) {
  try {
    const data = await PresupuestosService.enviarAprobacion(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function volverABorrador(req, res, next) {
  try {
    const data = await PresupuestosService.volverABorrador(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function aprobar(req, res, next) {
  try {
    const userId = req.user?.id || null
    const data = await PresupuestosService.aprobar(req.params.id, userId)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function rechazar(req, res, next) {
  try {
    const { motivo } = req.body || {}
    const data = await PresupuestosService.rechazar(req.params.id, motivo)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// ── PDF ─────────────────────────────────────────────────────
export async function getPdf(req, res, next) {
  try {
    const data = await PresupuestosService.getPdfSignedUrl(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Este presupuesto no tiene PDF cargado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function uploadPdf(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Falta archivo (field: archivo)' })
    const data = await PresupuestosService.uploadPdf(req.params.id, {
      buffer:   req.file.buffer,
      mimetype: req.file.mimetype,
    })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
