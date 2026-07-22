// src/controllers/invitaciones.controller.js
import * as InvitacionesService from '../services/invitaciones.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await InvitacionesService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function generar(req, res, next) {
  try {
    const { role } = req.body
    if (!role) {
      return res.status(400).json({ ok: false, error: 'role es obligatorio' })
    }
    const data = await InvitacionesService.generar({ role, creadoPor: req.user.id })
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
