// src/controllers/estanterias.controller.js
/**
 * Controllers del M8 — Estanterías.
 * Patrón thin estándar. `getByQR` resuelve el código QR escaneado a la
 * estantería correspondiente (entry point del flujo mobile de inventario
 * físico). `addItem` / `removeItem` / `moverItem` gestionan el contenido
 * de cada estantería.
 */
import * as EstanteriasService from '../services/estanterias.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await EstanteriasService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await EstanteriasService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Estantería no encontrada' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getByQR(req, res, next) {
  try {
    const data = await EstanteriasService.getByQR(req.params.qr)
    if (!data) return res.status(404).json({ ok: false, error: 'Estantería no encontrada' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const data = await EstanteriasService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await EstanteriasService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    await EstanteriasService.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function addItem(req, res, next) {
  try {
    const data = await EstanteriasService.addItem(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function removeItem(req, res, next) {
  try {
    await EstanteriasService.removeItem(req.params.itemId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function moverItem(req, res, next) {
  try {
    const { nuevaEstanteriaId } = req.body
    if (!nuevaEstanteriaId)
      return res.status(400).json({ ok: false, error: 'nuevaEstanteriaId es obligatorio' })
    const data = await EstanteriasService.moverItem(req.params.itemId, nuevaEstanteriaId)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
