// src/controllers/addons.controller.js
import * as AddonsService from '../services/addons.service.js'

export async function actualizarExtras(req, res, next) {
  try {
    const empleadosExtra = Number(req.body.empleadosExtra)
    const herramientasCupo = Number(req.body.herramientasCupo)
    if (!Number.isInteger(empleadosExtra) || !Number.isInteger(herramientasCupo)) {
      return res.status(400).json({ ok: false, error: 'empleadosExtra y herramientasCupo deben ser enteros' })
    }
    const data = await AddonsService.actualizarExtras({ empleadosExtra, herramientasCupo, payerEmail: req.user.email })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
