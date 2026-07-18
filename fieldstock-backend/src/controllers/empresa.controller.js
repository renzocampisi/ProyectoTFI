// src/controllers/empresa.controller.js
import * as EmpresaService from '../services/empresa.service.js'

// GET es accesible para cualquier usuario autenticado (todos necesitan
// ver el nombre de la empresa en el header, no solo DUEÑO/ADMIN).
export async function get(_req, res, next) {
  try {
    const data = await EmpresaService.get()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// PUT restringido a DUEÑO/ADMIN (ver requireRole en la ruta).
export async function set(req, res, next) {
  try {
    const userId = req.user?.id || null
    const data = await EmpresaService.set(req.body || {}, userId)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
