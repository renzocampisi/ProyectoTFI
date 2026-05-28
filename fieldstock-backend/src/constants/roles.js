// src/constants/roles.js
/**
 * Roles del sistema — fuente única de verdad.
 *
 * Importante: el valor tiene tilde ("DUEÑO") — debe coincidir con el CHECK
 * de la tabla usuarios y con la constante del frontend. Cualquier divergencia
 * de tilde hace que el backend rechace usuarios válidos.
 *
 * Si en algún momento agregamos roles nuevos (ej. CLIENTE, AUDITOR), se
 * agregan acá y también en el constraint de la tabla usuarios.
 */
export const ROLES = Object.freeze({
  DUEÑO:     'DUEÑO',
  ENCARGADO: 'ENCARGADO',
  OPERARIO:  'OPERARIO',
})

export const ROLES_LIST = Object.values(ROLES)
