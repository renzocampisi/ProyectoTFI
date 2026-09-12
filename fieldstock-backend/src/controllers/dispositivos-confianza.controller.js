// src/controllers/dispositivos-confianza.controller.js
// Controller thin — la lógica vive en dispositivos-confianza.service.js.
import * as DispositivosConfianzaService from '../services/dispositivos-confianza.service.js'

export async function registrar(req, res, next) {
  try {
    const data = await DispositivosConfianzaService.registrar(req.user.id, req.headers['user-agent'])
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getAll(req, res, next) {
  try {
    const data = await DispositivosConfianzaService.listar(req.user.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function revocarUno(req, res, next) {
  try {
    await DispositivosConfianzaService.revocarUno(req.user.id, req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function revocarTodos(req, res, next) {
  try {
    await DispositivosConfianzaService.revocarTodos(req.user.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

// Usado desde /usuarios/:id/dispositivos-confianza — un DUEÑO/ADMIN revoca
// los dispositivos de OTRO usuario (el empleado), no los propios.
export async function revocarTodosDeUsuario(req, res, next) {
  try {
    await DispositivosConfianzaService.revocarTodos(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
