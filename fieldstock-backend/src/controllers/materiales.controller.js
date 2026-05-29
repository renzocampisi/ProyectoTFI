// src/controllers/materiales.controller.js
/**
 * Controllers del M6 — Materiales (consumibles).
 * Patrón thin estándar — toda la lógica en materiales.service.js.
 * Nota: el namespace está como `MateriasService` por razones históricas
 * (módulo se llamaba "Materias" antes). Funcional, pero conviene
 * renombrar a `MaterialesService` para que matchee el filename.
 */
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

// Word #17 — lista de marcas únicas para el autocomplete del form
export async function getMarcas(req, res, next) {
  try {
    const data = await MateriasService.getMarcas()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

// Word #19 — soft delete (activo=false). El frontend confirma con el usuario.
export async function remove(req, res, next) {
  try {
    await MateriasService.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// Word #B — check de duplicados antes de crear. El frontend lo llama con
// query params ?nombre=...&marca=... y recibe el material existente o null.
// Permite ofrecer "sumar stock al existente" en vez de duplicar.
export async function checkDuplicate(req, res, next) {
  try {
    const { nombre, marca } = req.query
    const existente = await MateriasService.findDuplicate({ nombre, marca })
    res.json({ ok: true, data: existente })
  } catch (err) { next(err) }
}

// Word #B — agrega cantidad al stock_actual de un material existente.
// Disparado desde el modal "Este material ya existe, ¿sumar stock?".
export async function agregarStock(req, res, next) {
  try {
    const { cantidad } = req.body
    const data = await MateriasService.agregarStock(req.params.id, cantidad)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}
