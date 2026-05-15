// src/controllers/remitos.controller.js
import * as RemitosService from '../services/remitos.service.js'

export async function getAll(req, res, next) {
  try {
    const { tipo, estado } = req.query
    const data = await RemitosService.getAll({ tipo, estado })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await RemitosService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Remito no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { tipo, obra, responsable } = req.body
    if (!tipo || !obra || !responsable)
      return res.status(400).json({ ok: false, error: 'tipo, obra y responsable son obligatorios' })
    const data = await RemitosService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function addItem(req, res, next) {
  try {
    const { herramientaId } = req.body
    if (!herramientaId)
      return res.status(400).json({ ok: false, error: 'herramientaId es obligatorio' })
    const data = await RemitosService.addItem(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function removeItem(req, res, next) {
  try {
    await RemitosService.removeItem(req.params.id, req.params.itemId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function addMaterial(req, res, next) {
  try {
    const { cantidad } = req.body
    if (!cantidad)
      return res.status(400).json({ ok: false, error: 'cantidad es obligatoria' })
    const data = await RemitosService.addMaterial(req.params.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function removeMaterial(req, res, next) {
  try {
    await RemitosService.removeMaterial(req.params.id, req.params.matItemId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function avanzarEstado(req, res, next) {
  try {
    const data = await RemitosService.avanzarEstado(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function crearIngreso(req, res, next) {
  try {
    const data = await RemitosService.crearIngreso(req.params.id)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
export async function eliminar(req, res, next) {
  try {
    await RemitosService.eliminar(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}