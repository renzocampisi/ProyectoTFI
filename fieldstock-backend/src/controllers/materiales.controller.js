// src/controllers/materiales.controller.js
import * as MateriasService from '../services/materiales.service.js'

export async function getAll(req, res, next) {
  try {
    const { q } = req.query
    const data = await MateriasService.getAll({ q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await MateriasService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Material no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { nombre } = req.body
    if (!nombre) return res.status(400).json({ ok: false, error: 'nombre es obligatorio' })
    const data = await MateriasService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await MateriasService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
