// src/middlewares/requireRole.js
/**
 * Middleware factory: exige que el user logueado tenga uno de los roles
 * permitidos. Asume que `requireAuth` ya corrió y dejó `req.user` cargado.
 *
 * Uso:
 *   router.post('/usuarios', requireRole(['DUEÑO']), UsuariosCtrl.create)
 *
 * Devuelve 403 si el user no tiene el rol requerido (vs 401 que sería
 * "no autenticado"). Mensaje genérico para no filtrar información sobre
 * qué endpoints existen para otros roles.
 */
import { ROLES } from '../constants/roles.js'

export function requireRole(rolesPermitidos) {
  // Validación temprana: tipo correcto y roles válidos.
  if (!Array.isArray(rolesPermitidos) || rolesPermitidos.length === 0) {
    throw new Error('requireRole exige un array no vacío de roles')
  }
  const rolesValidos = Object.values(ROLES)
  for (const r of rolesPermitidos) {
    if (!rolesValidos.includes(r)) {
      throw new Error(`Rol desconocido en requireRole: "${r}". Válidos: ${rolesValidos.join(', ')}`)
    }
  }

  return function (req, res, next) {
    if (!req.user) {
      // Si pasa esto es bug de configuración — requireAuth tenía que correr antes.
      return res.status(401).json({ ok: false, error: 'No autenticado' })
    }
    if (!rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'No tenés permisos para esta acción' })
    }
    next()
  }
}
