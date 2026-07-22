// src/controllers/suscripcion.controller.js
/**
 * `webhook` es el único handler acá que NO usa `req.user` — lo llama
 * Mercado Pago directo, sin sesión de FieldStock. Ver montaje en
 * routes/index.js: vive antes de `router.use(requireAuth)`.
 */
import * as SuscripcionService from '../services/suscripcion.service.js'

export async function getEstado(req, res, next) {
  try {
    const data = await SuscripcionService.getEstado()
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function elegirPlan(req, res, next) {
  try {
    const { codigoPlan } = req.body
    if (!codigoPlan) {
      return res.status(400).json({ ok: false, error: 'codigoPlan es obligatorio' })
    }
    const backUrl = `${process.env.FRONTEND_URL}/facturacion`
    const data = await SuscripcionService.elegirPlan({ codigoPlan, payerEmail: req.user.email, backUrl })
    res.json({ ok: true, data })
  } catch (err) { next(err) }
}

export async function cancelar(req, res, next) {
  try {
    await SuscripcionService.cancelar()
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function webhook(req, res, next) {
  try {
    const { type } = req.body
    const dataId = req.body?.data?.id
    await SuscripcionService.procesarWebhook({ type, dataId, headers: req.headers, query: req.query })
    // Mercado Pago solo necesita un 200 — no procesa el body de la respuesta.
    res.sendStatus(200)
  } catch (err) { next(err) }
}
