// src/controllers/obras.controller.js
import * as ObrasService from '../services/obras.service.js'

export async function getAll(req, res, next) {
  try {
    const { estado, q } = req.query
    const data = await ObrasService.getAll({ estado, q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await ObrasService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Obra no encontrada' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { nombre, direccion, cliente, fechaInicio } = req.body
    if (!nombre || !direccion || !cliente || !fechaInicio)
      return res.status(400).json({ ok: false, error: 'nombre, direccion, cliente y fechaInicio son obligatorios' })
    const data = await ObrasService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await ObrasService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function finalizar(req, res, next) {
  try {
    const data = await ObrasService.finalizar(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function reactivar(req, res, next) {
  try {
    const data = await ObrasService.reactivar(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
