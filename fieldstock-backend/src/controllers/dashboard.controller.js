// src/controllers/dashboard.controller.js
/**
 * Controller del Dashboard de inicio (Word #16).
 * Patrón thin — toda la lógica de agregación vive en dashboard.service.js.
 */
import * as DashboardService from '../services/dashboard.service.js'

export async function getResumen(req, res, next) {
  try {
    const data = await DashboardService.getResumen()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
