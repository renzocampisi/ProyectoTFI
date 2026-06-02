// src/constants/roles.js
/**
 * Roles del sistema — fuente única de verdad.
 *
 * Importante: el valor tiene tilde ("DUEÑO") — debe coincidir con el CHECK
 * de la tabla usuarios y con la constante del frontend. Cualquier divergencia
 * de tilde hace que el backend rechace usuarios válidos.
 *
 * Jerarquía conceptual:
 *   ADMIN > DUEÑO > ENCARGADO > OPERARIO
 *
 * ADMIN y DUEÑO tienen los MISMOS permisos en este momento — ADMIN existe
 * como rol separado para escalamiento futuro (ej. ADMIN podrá ver/gestionar
 * múltiples empresas, configuración global, etc). Usar la constante
 * `ROLES_ADMIN_LEVEL` para los checks que aplican a ambos.
 */
export const ROLES = Object.freeze({
  ADMIN:     'ADMIN',
  DUEÑO:     'DUEÑO',
  ENCARGADO: 'ENCARGADO',
  OPERARIO:  'OPERARIO',
})

export const ROLES_LIST = Object.values(ROLES)

// Roles con permisos administrativos plenos. Usar en lugar de
// `[ROLES.DUEÑO]` cuando se chequea autorización de operaciones de gestión
// (CRUD de usuarios, volver-a-borrador, etc).
export const ROLES_ADMIN_LEVEL = Object.freeze([ROLES.ADMIN, ROLES.DUEÑO])
