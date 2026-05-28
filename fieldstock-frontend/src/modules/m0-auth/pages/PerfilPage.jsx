// src/modules/m0-auth/pages/PerfilPage.jsx
/**
 * Página "Mi perfil" — accesible para los 3 roles. Permite editar el
 * propio nombre y teléfono. Email y rol son read-only (cambiar email
 * va por flujo de Supabase Auth, cambiar rol lo hace el DUEÑO desde
 * /usuarios).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { ROLE_LABELS } from '@shared/constants/roles'
import { UsuariosService } from '@modules/m9-usuarios/services/usuarios.service'
import styles from './PerfilPage.module.css'

export default function PerfilPage() {
  const navigate = useNavigate()
  const { profile, refrescarPerfil } = useAuth()
  const [form,    setForm]    = useState({ nombre: '', telefono: '' })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (profile) {
      setForm({ nombre: profile.nombre || '', telefono: profile.telefono || '' })
    }
  }, [profile])

  if (!profile) return null  // AuthProvider todavía cargando — RequireAuth ya manejó el caso

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.'); return
    }
    setSaving(true); setError(null); setSaved(false)
    try {
      await UsuariosService.updateMe({
        nombre:   form.nombre.trim(),
        telefono: form.telefono.trim() || null,
      })
      await refrescarPerfil()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate(-1)}>← Volver</button>
        <div>
          <h1 className={styles.title}>Mi perfil</h1>
          <p className={styles.subtitle}>Datos personales que usás dentro del sistema.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Cuenta</legend>
          <div className={styles.fields}>
            <div className={styles.field}>
              <span className={styles.label}>Email</span>
              <div className={styles.readonly}>{profile.email}</div>
              <span className={styles.hint}>El email no se puede cambiar desde acá.</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Rol</span>
              <div className={styles.readonly}>{ROLE_LABELS[profile.role] || profile.role}</div>
              <span className={styles.hint}>Lo gestiona el dueño desde "Usuarios".</span>
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Datos editables</legend>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="nombre">Nombre y apellido</label>
              <input id="nombre" type="text" className={styles.input}
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="telefono">Teléfono</label>
              <input id="telefono" type="tel" className={styles.input}
                placeholder="+54 9 11 ..."
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
              <span className={styles.hint}>
                Se muestra en el PDF de los remitos donde figurás como responsable.
              </span>
            </div>
          </div>
        </fieldset>

        {error && <div className={styles.errorBanner}>⚠ {error}</div>}
        {saved && <div className={styles.savedBanner}>✓ Cambios guardados</div>}

        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
