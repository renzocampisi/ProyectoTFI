// src/controllers/kits.controller.js
/**
 * Controllers de kits de herramientas. Patrón thin estándar — lógica en
 * kits.service.js. `agregarARemito` vive acá pero delega toda la lógica
 * de composición al service (kits.service.agregarARemito).
 */
import * as KitsService from '../services/kits.service.js'

export async function getAll(req, res, next) {
  try {
    const { q } = req.query
    const data = await KitsService.getAll({ q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await KitsService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Kit no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getByHerramienta(req, res, next) {
  try {
    const data = await KitsService.getByHerramienta(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const data = await KitsService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await KitsService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    await KitsService.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function agregarARemito(req, res, next) {
  try {
    const data = await KitsService.agregarARemito(req.params.remitoId, req.params.kitId)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
