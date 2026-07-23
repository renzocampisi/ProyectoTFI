// src/middlewares/requireSuscripcionActiva.js
/**
 * Corta el acceso a la API si la suscripción de esta instancia está
 * BLOQUEADA (prueba vencida sin elegir plan, o vencida más allá del
 * período de gracia). Corre después de requireAuth.
 *
 * Deja pasar sin importar el estado a las rutas que alguien BLOQUEADO
 * necesita para poder pagar y salir del bloqueo: ver el estado de su
 * suscripción, ver los planes disponibles, y ver su propio perfil (lo usa
 * el frontend para renderizar la pantalla de "regularizá tu pago").
 */
import * as SuscripcionService from '../services/suscripcion.service.js'

const RUTAS_EXCEPTUADAS = ['/suscripcion', '/planes', '/usuarios/me']

function estaExceptuada(path) {
  return RUTAS_EXCEPTUADAS.some(p => path === p || path.startsWith(`${p}/`))
}

export async function requireSuscripcionActiva(req, res, next) {
  try {
    if (estaExceptuada(req.path)) return next()

    const suscripcion = await SuscripcionService.getActual()
    const estado = SuscripcionService.calcularEstadoEfectivo(suscripcion)

    if (estado === 'BLOQUEADA') {
      return res.status(402).json({
        ok: false,
        error: 'La suscripción de esta instancia está vencida. Regularizá el pago desde Facturación para seguir usando el sistema.',
      })
    }
    next()
  } catch (err) {
    next(err)
  }
}
