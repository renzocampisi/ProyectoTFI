// src/middlewares/errorHandler.js
/**
 * Error handler global de Express (4 argumentos = Express lo reconoce como handler).
 *
 * Convención del proyecto:
 *   - Los services lanzan errores plain con `err.status` opcional:
 *       const err = new Error('mensaje'); err.status = 400; throw err
 *   - Los controllers propagan con next(err) en su catch.
 *   - Este middleware traduce todo eso a JSON: { ok: false, error: mensaje }
 *   - Si no hay status, se asume 500.
 *
 * Logueo: imprime el error completo a stderr (incluye stack). En producción
 * convendría enviar a un agregador (Sentry, etc.).
 */
export function errorHandler(err, req, res, next) {
  console.error('[FieldStock Error]', err)
  const status  = err.status  || 500
  const message = err.message || 'Error interno del servidor'
  res.status(status).json({ ok: false, error: message })
}
