// src/controllers/config.controller.js
import * as ConfigService from '../services/config.service.js'

export async function getAll(_req, res, next) {
  try {
    const data = await ConfigService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function get(req, res, next) {
  try {
    const value = await ConfigService.get(req.params.key)
    if (value === null) return res.status(404).json({ ok: false, error: `Config "${req.params.key}" no existe` })
    res.json({ ok: true, data: { key: req.params.key, value } })
  } catch (err) { next(err) }
}

export async function set(req, res, next) {
  try {
    const { value } = req.body || {}
    if (value === undefined || value === null || value === '') {
      return res.status(400).json({ ok: false, error: 'value es obligatorio' })
    }
    const userId = req.user?.id || null
    const data = await ConfigService.set(req.params.key, value, userId)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
