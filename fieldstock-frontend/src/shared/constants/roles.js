// src/shared/constants/roles.js
/**
 * Roles del sistema — espejo del backend (constants/roles.js).
 *
 * El valor tiene tilde ("DUEÑO") — debe coincidir exactamente con el CHECK
 * de la tabla usuarios y la constante del backend. Cualquier divergencia
 * hace que requireRole rechace al usuario.
 */
export const ROLES = Object.freeze({
  DUEÑO:     'DUEÑO',
  ENCARGADO: 'ENCARGADO',
  OPERARIO:  'OPERARIO',
})

// Etiquetas legibles para la UI (con primera mayúscula, sin caps lock).
export const ROLE_LABELS = Object.freeze({
  DUEÑO:     'Dueño',
  ENCARGADO: 'Encargado',
  OPERARIO:  'Operario',
})

// Helpers de check semántico para usar en componentes.
export const esDueño     = (role) => role === ROLES.DUEÑO
export const puedeEditar = (role) => role === ROLES.DUEÑO || role === ROLES.ENCARGADO
