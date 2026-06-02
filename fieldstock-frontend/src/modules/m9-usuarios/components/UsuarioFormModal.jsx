// src/modules/m9-usuarios/components/UsuarioFormModal.jsx
/**
 * Modal de creación / edición de un usuario.
 *
 * - Modo CREATE: pide email + nombre + tel + rol. Devuelve { usuario, passwordPlano }
 *   y el parent muestra el PasswordRevealModal.
 * - Modo EDIT: pide nombre + tel + rol + activo. El email no se puede cambiar
 *   acá (es flujo separado en Supabase Auth).
 */
import { useState, useEffect } from 'react'
import { ROLES, ROLE_LABELS } from '@shared/constants/roles'
import { UsuariosService } from '../services/usuarios.service'
import styles from './UsuarioFormModal.module.css'

const ROLES_OPTIONS = [
  { value: ROLES.ADMIN,     label: ROLE_LABELS.ADMIN },
  { value: ROLES.DUEÑO,     label: ROLE_LABELS.DUEÑO },
  { value: ROLES.ENCARGADO, label: ROLE_LABELS.ENCARGADO },
  { value: ROLES.OPERARIO,  label: ROLE_LABELS.OPERARIO },
]

export default function UsuarioFormModal({ usuario, onClose, onCreated, onUpdated }) {
  const esEdicion = Boolean(usuario)
  const [form, setForm] = useState({
    email:    usuario?.email    || '',
    nombre:   usuario?.nombre   || '',
    telefono: usuario?.telefono || '',
    role:     usuario?.role     || ROLES.OPERARIO,
    activo:   usuario?.activo ?? true,
  })
  const [errores, setErrores] = useState({})
  const [saving,  setSaving]  = useState(false)

  // Si el `usuario` cambia (por ejemplo, abrir el modal con otro user) se
  // resetea el form. Útil si el parent reusa la misma instancia del modal.
  useEffect(() => {
    if (usuario) {
      setForm({
        email:    usuario.email    || '',
        nombre:   usuario.nombre   || '',
        telefono: usuario.telefono || '',
        role:     usuario.role     || ROLES.OPERARIO,
        activo:   usuario.activo ?? true,
      })
    }
  }, [usuario])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!esEdicion && !form.email.trim())                e.email  = 'El email es obligatorio.'
    if (!esEdicion && form.email && !form.email.includes('@')) e.email = 'Email inválido.'
    if (!form.nombre.trim())                              e.nombre = 'El nombre es obligatorio.'
    if (!form.role)                                       e.role   = 'Elegí un rol.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setSaving(true)
    try {
      if (esEdicion) {
        const updated = await UsuariosService.update(usuario.id, {
          nombre:   form.nombre.trim(),
          telefono: form.telefono.trim() || null,
          role:     form.role,
          activo:   form.activo,
        })
        onUpdated?.(updated)
      } else {
        const result = await UsuariosService.create({
          email:    form.email.trim().toLowerCase(),
          nombre:   form.nombre.trim(),
          telefono: form.telefono.trim() || null,
          role:     form.role,
        })
        // result = { usuario, passwordPlano }
        onCreated?.(result)
      }
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.card} onClick={e => e.stopPropagation()} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>
          {esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>

        {!esEdicion && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email <span className={styles.req}>*</span></label>
            <input id="email" type="email" autoComplete="off"
              className={`${styles.input} ${errores.email ? styles.inputError : ''}`}
              placeholder="usuario@empresa.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
            {errores.email && <span className={styles.error}>{errores.email}</span>}
          </div>
        )}
        {esEdicion && (
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <div className={styles.readonly}>{form.email}</div>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="nombre">Nombre y apellido <span className={styles.req}>*</span></label>
          <input id="nombre" type="text"
            className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
            placeholder="Juan Pérez"
            value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="telefono">Teléfono <span className={styles.optional}>(opcional)</span></label>
          <input id="telefono" type="tel"
            className={styles.input}
            placeholder="+54 9 11 ..."
            value={form.telefono} onChange={e => set('telefono', e.target.value)} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="role">Rol <span className={styles.req}>*</span></label>
          <select id="role" className={styles.input}
            value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {esEdicion && (
          <div className={styles.field}>
            <label className={styles.checkboxRow}>
              <input type="checkbox"
                checked={form.activo}
                onChange={e => set('activo', e.target.checked)} />
              <span>Cuenta activa</span>
            </label>
          </div>
        )}

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        {!esEdicion && (
          <p className={styles.helper}>
            La contraseña se genera automáticamente y se muestra una sola vez después de crear.
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Guardando...' : (esEdicion ? 'Guardar cambios' : 'Crear usuario')}
          </button>
        </div>
      </form>
    </div>
  )
}
