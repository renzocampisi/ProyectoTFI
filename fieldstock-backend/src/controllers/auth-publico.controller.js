// src/controllers/auth-publico.controller.js
import * as AuthPublicoService from '../services/auth-publico.service.js'

export async function getEstado(req, res, next) {
  try {
    const hayUsuarios = await AuthPublicoService.hayUsuarios()
    res.json({ ok: true, data: { hayUsuarios } })
  } catch (err) { next(err) }
}

export async function registrarDueño(req, res, next) {
  try {
    const { email, password, nombre, telefono, empresa } = req.body
    const data = await AuthPublicoService.registrarDueño({ email, password, nombre, telefono, empresa })
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function registrarConInvitacion(req, res, next) {
  try {
    const { codigo, email, password, nombre, telefono } = req.body
    const data = await AuthPublicoService.registrarConInvitacion({ codigo, email, password, nombre, telefono })
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}
