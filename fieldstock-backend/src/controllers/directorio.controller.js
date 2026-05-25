// src/controllers/directorio.controller.js
/**
 * Controllers del M7 — Directorio (transportes + clientes).
 *
 * Dos CRUDs espejados (uno para transportes, otro para clientes). Si
 * aparece una tercera entidad similar (proveedores), conviene extraer
 * un helper genérico o un controller factory en lugar de seguir copiando.
 *
 * `delete*` aplica borrado SOFT (activo=false) — los datos quedan para
 * mantener integridad referencial con remitos antiguos.
 */
import * as DirectorioService from '../services/directorio.service.js'

// ── TRANSPORTES ───────────────────────────────────────────────
export async function getTransportes(req, res, next) {
  try {
    const data = await DirectorioService.getAllTransportes({ q: req.query.q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function createTransporte(req, res, next) {
  try {
    if (!req.body.nombre)
      return res.status(400).json({ ok: false, error: 'nombre es obligatorio' })
    const data = await DirectorioService.createTransporte(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function updateTransporte(req, res, next) {
  try {
    if (!req.body.nombre)
      return res.status(400).json({ ok: false, error: 'nombre es obligatorio' })
    const data = await DirectorioService.updateTransporte(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function deleteTransporte(req, res, next) {
  try {
    await DirectorioService.deleteTransporte(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// ── CLIENTES ──────────────────────────────────────────────────
export async function getClientes(req, res, next) {
  try {
    const data = await DirectorioService.getAllClientes({ q: req.query.q })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function createCliente(req, res, next) {
  try {
    if (!req.body.nombre)
      return res.status(400).json({ ok: false, error: 'nombre es obligatorio' })
    const data = await DirectorioService.createCliente(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function updateCliente(req, res, next) {
  try {
    if (!req.body.nombre)
      return res.status(400).json({ ok: false, error: 'nombre es obligatorio' })
    const data = await DirectorioService.updateCliente(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function deleteCliente(req, res, next) {
  try {
    await DirectorioService.deleteCliente(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
