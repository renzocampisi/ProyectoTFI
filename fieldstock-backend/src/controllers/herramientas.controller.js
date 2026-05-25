// src/controllers/herramientas.controller.js
/**
 * Controllers del M2 — Herramientas.
 *
 * Patrón estándar del proyecto:
 *   try { ... res.json({ ok: true, data }) } catch (err) { next(err) }
 *
 * El controller solo hace req/res + valida campos obligatorios + delega
 * al service. Toda la lógica de dominio (validación de estados, RPCs,
 * generación de QR) vive en herramientas.service.js.
 *
 * Status codes:
 *   200 → operación exitosa
 *   201 → recurso creado
 *   400 → validación (campos faltantes, estado inválido)
 *   404 → recurso no encontrado en getById
 *   500 → error inesperado (propagado al errorHandler global)
 */
import * as HerramientasService from '../services/herramientas.service.js'

export async function getAll(req, res, next) {
  try {
    const { estado, categoriaId, q, codigoQR } = req.query
    const data = await HerramientasService.getAll({ estado, categoriaId, q, codigoQR })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await HerramientasService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Herramienta no encontrada' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { nombre, categoriaId } = req.body
    if (!nombre || !categoriaId) {
      return res.status(400).json({ ok: false, error: 'nombre y categoriaId son obligatorios' })
    }
    const data = await HerramientasService.create(req.body)
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function updateEstado(req, res, next) {
  try {
    const { estado } = req.body
    if (!estado) return res.status(400).json({ ok: false, error: 'estado es obligatorio' })
    const data = await HerramientasService.updateEstado(req.params.id, estado)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await HerramientasService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function darDeBaja(req, res, next) {
  try {
    const data = await HerramientasService.darDeBaja(req.params.id, req.body.motivo)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function reactivar(req, res, next) {
  try {
    const data = await HerramientasService.reactivar(req.params.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
