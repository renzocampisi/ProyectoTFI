// src/controllers/usuarios.controller.js
/**
 * Controller thin para usuarios. Toda lógica vive en usuarios.service.js.
 *
 * El endpoint `create` devuelve `{ usuario, passwordPlano }` — el frontend
 * usa `passwordPlano` para mostrarlo UNA SOLA VEZ en el modal de éxito y
 * después no lo persiste en ningún lado.
 */
import * as UsuariosService from '../services/usuarios.service.js'

export async function getAll(req, res, next) {
  try {
    const data = await UsuariosService.getAll()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getById(req, res, next) {
  try {
    const data = await UsuariosService.getById(req.params.id)
    if (!data) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function getMe(req, res, next) {
  try {
    // req.user lo carga requireAuth — ya tiene el perfil completo. Lo
    // releemos por consistencia + por si se actualizó en otro tab.
    const data = await UsuariosService.getMe(req.user.id)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const { email, nombre, telefono, role } = req.body
    if (!email || !nombre || !role) {
      return res.status(400).json({ ok: false, error: 'email, nombre y role son obligatorios' })
    }
    const data = await UsuariosService.create({ email, nombre, telefono, role })
    res.status(201).json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const data = await UsuariosService.update(req.params.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function updateMe(req, res, next) {
  try {
    const data = await UsuariosService.updateMe(req.user.id, req.body)
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function desactivar(req, res, next) {
  try {
    // Guard: el dueño no puede auto-desactivarse (se quedaría afuera sin
    // forma de reactivarse). Para casos extremos siempre puede otro DUEÑO
    // o un INSERT directo en Supabase Dashboard.
    if (req.params.id === req.user.id) {
      return res.status(400).json({ ok: false, error: 'No podés desactivar tu propia cuenta' })
    }
    await UsuariosService.desactivar(req.params.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
