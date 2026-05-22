// src/controllers/notificaciones.controller.js
import * as NotifService from '../services/notificaciones.service.js'

export async function getAll(req, res, next) {
  try {
    const soloNoLeidas = req.query.noLeidas === 'true'
    const data = await NotifService.getAll({ soloNoLeidas })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { titulo, mensaje } = req.body
    if (!titulo || !mensaje)
      return res.status(400).json({ ok: false, error: 'titulo y mensaje son obligatorios' })
    const data = await NotifService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function marcarLeida(req, res, next) {
  try {
    const data = await NotifService.marcarLeida(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function marcarTodasLeidas(req, res, next) {
  try {
    await NotifService.marcarTodasLeidas()
    res.json({ ok: true })
  } catch (err) { next(err) }
}
