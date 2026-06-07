// src/services/usuarios.service.js
/**
 * Service de gestión de usuarios del sistema.
 *
 * Convenciones:
 * - El email vive en auth.users (Supabase Auth). Lo leemos vía la vista
 *   `usuarios_resumen` que joinea email + perfil.
 * - La creación es atómica desde el punto de vista del caller:
 *     1) supabase.auth.admin.createUser → crea en auth.users + valida email único
 *     2) INSERT en usuarios → crea perfil
 *   Si el paso 2 falla, hacemos rollback borrando el auth.user para no dejar
 *   inconsistencias. Sin esto, un email queda "tomado" en Auth sin perfil.
 * - El soft delete (desactivar) NO toca auth.users — el user sigue existiendo
 *   pero `requireAuth` lo rechaza por activo=false. Conserva la historia
 *   (remitos viejos que lo referencian via responsable_user_id).
 *
 * Permisos: la mayoría de endpoints requieren rol DUEÑO. Las acciones sobre
 * el propio perfil (getMe / updateMe) no necesitan rol específico — basta
 * con estar autenticado.
 */
import { supabase } from '../config/supabase.js'
import { ROLES_LIST } from '../constants/roles.js'
import { genPassword } from '../utils/genPassword.js'

// ── Lectura ───────────────────────────────────────────────────

export async function getAll() {
  const { data, error } = await supabase
    .from('usuarios_resumen')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('usuarios_resumen')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Para el endpoint GET /usuarios/me — el frontend lo llama después del login
// para obtener el perfil completo (lo que requireAuth ya cargó en req.user).
export async function getMe(id) {
  return getById(id)
}

// ── Escritura ─────────────────────────────────────────────────

/**
 * Crea un usuario nuevo. Devuelve el perfil + la password en texto plano
 * (UNA SOLA VEZ — la mostramos al dueño en el modal de éxito y no la
 * volvemos a entregar nunca).
 */
export async function create({ email, nombre, telefono, role }) {
  // Validación temprana.
  if (!email?.trim())  { const e = new Error('email es obligatorio');  e.status = 400; throw e }
  if (!nombre?.trim()) { const e = new Error('nombre es obligatorio'); e.status = 400; throw e }
  if (!ROLES_LIST.includes(role)) {
    const e = new Error(`role inválido. Debe ser uno de: ${ROLES_LIST.join(', ')}`)
    e.status = 400; throw e
  }

  const passwordPlano = genPassword(8)

  // Paso 1: crear en auth.users via admin API.
  const { data: authData, error: errAuth } = await supabase.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    password:      passwordPlano,
    email_confirm: true,  // saltea el flujo de verificación por email (no tenemos SMTP)
  })
  if (errAuth) {
    // Errores típicos: "email already registered" (422), "invalid email" (400).
    // Propagamos con el status apropiado para que el controller lo refleje.
    const e = new Error(errAuth.message || 'No se pudo crear el usuario en Auth')
    e.status = errAuth.status || 400; throw e
  }
  const userId = authData.user.id

  // Paso 2: INSERT del perfil. Si falla, rollback del auth.user.
  const { data: perfil, error: errP } = await supabase
    .from('usuarios')
    .insert({
      id:       userId,
      nombre:   nombre.trim(),
      telefono: telefono?.trim() || null,
      role,
      activo:   true,
    })
    .select()
    .single()

  if (errP) {
    // Rollback best-effort: borramos el auth.user para no dejar el email
    // "tomado". Si esto también falla, queda como inconsistencia que el
    // dueño tiene que resolver manualmente desde el Supabase Dashboard.
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    const e = new Error(errP.message || 'No se pudo crear el perfil del usuario')
    e.status = 500; throw e
  }

  return {
    usuario:       { ...perfil, email: email.trim().toLowerCase() },
    passwordPlano, // ← solo se devuelve UNA VEZ acá
  }
}

/**
 * Reset administrativo de password. Genera una nueva (o usa la custom si el
 * caller la provee) y la persiste en auth.users via admin API. Devuelve el
 * password en plano UNA SOLA VEZ — el frontend lo muestra en un modal con
 * botón "Copiar" para que el dueño se lo pase al user por fuera.
 *
 * Largo default 12 (más larga que las generadas en `create`, asumimos que un
 * reset suele ser por compromiso/olvido y conviene un poco más de entropía).
 * Si viene `customPassword`, validar mínimo 8 chars — mismo piso que Supabase
 * Auth requiere por defecto.
 *
 * No loguear nunca el `passwordPlano` ni meterlo en URL/cookie.
 */
export async function resetPassword(id, customPassword) {
  const password = customPassword?.trim() || genPassword(12)
  if (password.length < 8) {
    const e = new Error('La password debe tener al menos 8 caracteres')
    e.status = 400; throw e
  }

  // Validar que el usuario existe antes de intentar el update — si no, Supabase
  // tira un 404 con un mensaje menos claro.
  const usuario = await getById(id)
  if (!usuario) {
    const e = new Error('Usuario no encontrado'); e.status = 404; throw e
  }

  const { error: errAuth } = await supabase.auth.admin.updateUserById(id, { password })
  if (errAuth) {
    const e = new Error(errAuth.message || 'No se pudo resetear la password')
    e.status = errAuth.status || 500; throw e
  }

  return { passwordPlano: password }
}

/**
 * Update del perfil. El email NO se puede cambiar acá (cambiar email es flujo
 * separado en Supabase Auth que requiere confirmación por email).
 */
export async function update(id, body) {
  const campos = {}
  if (body.nombre   !== undefined) campos.nombre   = body.nombre?.trim() || null
  if (body.telefono !== undefined) campos.telefono = body.telefono?.trim() || null
  if (body.role     !== undefined) {
    if (!ROLES_LIST.includes(body.role)) {
      const e = new Error(`role inválido. Debe ser uno de: ${ROLES_LIST.join(', ')}`)
      e.status = 400; throw e
    }
    campos.role = body.role
  }
  if (body.activo !== undefined) campos.activo = !!body.activo
  campos.updated_at = new Date().toISOString()

  if (Object.keys(campos).length === 1) {  // solo updated_at
    const e = new Error('No hay campos para actualizar'); e.status = 400; throw e
  }

  const { data, error } = await supabase
    .from('usuarios').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}

/**
 * Soft delete: marca activo=false. No borra el auth.user ni el perfil para
 * conservar la historia (remitos viejos que referencian a este user_id).
 */
export async function desactivar(id) {
  const { error } = await supabase
    .from('usuarios')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Update de los datos propios del usuario logueado (nombre, telefono).
 * No permite cambiar role ni activo — esos son privilegios del DUEÑO via
 * el endpoint update() normal.
 */
export async function updateMe(id, { nombre, telefono }) {
  const campos = {}
  if (nombre   !== undefined) campos.nombre   = nombre?.trim()   || null
  if (telefono !== undefined) campos.telefono = telefono?.trim() || null
  campos.updated_at = new Date().toISOString()

  if (Object.keys(campos).length === 1) {
    const e = new Error('No hay campos para actualizar'); e.status = 400; throw e
  }

  const { data, error } = await supabase
    .from('usuarios').update(campos).eq('id', id).select().single()
  if (error) throw error
  return data
}
