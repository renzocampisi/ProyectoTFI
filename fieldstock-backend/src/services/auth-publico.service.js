// src/services/auth-publico.service.js
/**
 * Registro self-service. Sistema single-tenant (sin empresa_id en el
 * schema) — para no mezclar datos de empresas distintas, solo hay DOS
 * caminos de alta, nunca un registro libre:
 *
 *   1) Bootstrap: si `usuarios` está vacía, el primer registro se convierte
 *      en DUEÑO y carga los datos de su empresa en el mismo paso (reusa
 *      empresa.service). Una vez que existe al menos un usuario, este
 *      camino se cierra (409) — ya hay un "dueño" de la instancia.
 *   2) Invitado: cualquier alta posterior requiere un código de invitación
 *      vigente generado por un DUEÑO/ADMIN desde /usuarios (ver
 *      invitaciones.service.js). El rol lo trae la invitación — nunca
 *      DUEÑO, eso es exclusivo del bootstrap.
 *
 * Mismo patrón de creación en dos pasos que usuarios.service.create():
 * auth.users primero, perfil en `usuarios` después, con rollback del
 * auth.user si el segundo paso falla.
 */
import { supabase } from '../config/supabase.js'
import { ROLES } from '../constants/roles.js'
import * as InvitacionesService from './invitaciones.service.js'
import * as EmpresaService from './empresa.service.js'

function validarCredenciales({ email, password, nombre }) {
  if (!email?.trim())  { const e = new Error('email es obligatorio');  e.status = 400; throw e }
  if (!nombre?.trim()) { const e = new Error('nombre es obligatorio'); e.status = 400; throw e }
  if (!password || password.length < 8) {
    const e = new Error('La contraseña debe tener al menos 8 caracteres')
    e.status = 400; throw e
  }
}

export async function hayUsuarios() {
  const { count, error } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return (count || 0) > 0
}

async function crearAuthYPerfil({ email, password, nombre, telefono, role }) {
  const { data: authData, error: errAuth } = await supabase.auth.admin.createUser({
    email:         email.trim().toLowerCase(),
    password,
    email_confirm: true,
  })
  if (errAuth) {
    const e = new Error(errAuth.message || 'No se pudo crear el usuario')
    e.status = errAuth.status || 400; throw e
  }
  const userId = authData.user.id

  const { data: perfil, error: errP } = await supabase
    .from('usuarios')
    .insert({ id: userId, nombre: nombre.trim(), telefono: telefono?.trim() || null, role, activo: true })
    .select()
    .single()

  if (errP) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    const e = new Error(errP.message || 'No se pudo crear el perfil del usuario')
    e.status = 500; throw e
  }

  return { ...perfil, email: email.trim().toLowerCase() }
}

export async function registrarDueño({ email, password, nombre, telefono, empresa }) {
  validarCredenciales({ email, password, nombre })
  if (!empresa?.nombre?.trim()) {
    const e = new Error('El nombre de la empresa es obligatorio')
    e.status = 400; throw e
  }

  // Guard: el bootstrap solo corre una vez — si ya hay usuarios, esta
  // instancia ya tiene dueño y este camino queda cerrado.
  if (await hayUsuarios()) {
    const e = new Error('Ya existe un dueño registrado en esta instancia. Pedile una invitación al administrador.')
    e.status = 409; throw e
  }

  const usuario = await crearAuthYPerfil({ email, password, nombre, telefono, role: ROLES.DUEÑO })
  await EmpresaService.set(empresa, usuario.id)

  return { usuario }
}

export async function registrarConInvitacion({ codigo, email, password, nombre, telefono }) {
  validarCredenciales({ email, password, nombre })
  if (!codigo?.trim()) {
    const e = new Error('El código de invitación es obligatorio')
    e.status = 400; throw e
  }

  const invitacion = await InvitacionesService.getVigentePorCodigo(codigo)
  if (!invitacion) {
    const e = new Error('El código de invitación no existe o ya fue usado')
    e.status = 404; throw e
  }

  const usuario = await crearAuthYPerfil({ email, password, nombre, telefono, role: invitacion.role })
  await InvitacionesService.marcarUsada(invitacion.id, usuario.id)

  return { usuario }
}
