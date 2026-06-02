// src/shared/constants/roles.js
/**
 * Roles del sistema — espejo del backend (constants/roles.js).
 *
 * Jerarquía conceptual:
 *   ADMIN > DUEÑO > ENCARGADO > OPERARIO
 *
 * ADMIN y DUEÑO tienen los mismos permisos por ahora — ADMIN existe como
 * rol separado para escalamiento futuro (multi-empresa, configuración
 * global). Usar el helper `esDueño()` para checks de "tiene permisos
 * de nivel dueño" — devuelve true tanto para DUEÑO como para ADMIN.
 *
 * El valor tiene tilde ("DUEÑO") — debe coincidir exactamente con el CHECK
 * de la tabla usuarios y la constante del backend. Cualquier divergencia
 * hace que requireRole rechace al usuario.
 */
export const ROLES = Object.freeze({
  ADMIN:     'ADMIN',
  DUEÑO:     'DUEÑO',
  ENCARGADO: 'ENCARGADO',
  OPERARIO:  'OPERARIO',
})

// Etiquetas legibles para la UI (con primera mayúscula, sin caps lock).
export const ROLE_LABELS = Object.freeze({
  ADMIN:     'Admin',
  DUEÑO:     'Dueño',
  ENCARGADO: 'Encargado',
  OPERARIO:  'Operario',
})

// Roles con permisos administrativos plenos — usar en RequireRole y checks
// de permisos. Reemplaza el viejo `[ROLES.DUEÑO]` para que ADMIN herede
// automáticamente todo lo que el DUEÑO puede hacer.
export const ROLES_ADMIN_LEVEL = Object.freeze([ROLES.ADMIN, ROLES.DUEÑO])

// Helpers de check semántico para usar en componentes.
// `esDueño` devuelve true para DUEÑO y ADMIN — semánticamente "tiene
// permisos de dueño". Si en el futuro ADMIN gana permisos exclusivos,
// usar `esAdminEstricto` para distinguir.
export const esDueño         = (role) => role === ROLES.DUEÑO || role === ROLES.ADMIN
export const esAdminEstricto = (role) => role === ROLES.ADMIN
export const puedeEditar     = (role) => esDueño(role) || role === ROLES.ENCARGADO
