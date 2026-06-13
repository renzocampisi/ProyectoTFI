// src/modules/m0-auth/pages/PerfilPage.jsx
/**
 * Página "Mi perfil" — accesible para los 3 roles. Permite editar el
 * propio nombre y teléfono. Email y rol son read-only (cambiar email
 * va por flujo de Supabase Auth, cambiar rol lo hace el DUEÑO desde
 * /usuarios).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '@shared/hooks/useAuth'
import { ROLE_LABELS } from '@shared/constants/roles'
import { supabase } from '@shared/utils/supabaseClient'
import { UsuariosService } from '@modules/m9-usuarios/services/usuarios.service'
import styles from './PerfilPage.module.css'

export default function PerfilPage() {
  const navigate = useNavigate()
  const { profile, refrescarPerfil } = useAuth()
  const [form,    setForm]    = useState({ nombre: '', telefono: '' })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(null)

  // ── Cambio de contraseña ────────────────────────────────────
  // No pedimos password actual: el user ya esta logueado (session activa),
  // eso es prueba de identidad suficiente (mismo criterio que Notion,
  // Linear, etc.). Supabase Auth tampoco tiene API directa para validar
  // la password actual sin hacer un signIn temporal — agregar eso seria
  // complejidad sin valor real.
  const [passForm, setPassForm] = useState({ nueva: '', confirm: '' })
  const [mostrarPass, setMostrarPass] = useState({ nueva: false, confirm: false })
  const [savingPass, setSavingPass] = useState(false)
  const [savedPass,  setSavedPass]  = useState(false)
  const [errorPass,  setErrorPass]  = useState(null)

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

  const handleChangePassword = async (ev) => {
    ev.preventDefault()
    setErrorPass(null); setSavedPass(false)

    // Validaciones cliente-side. El minimo de 8 es el default de Supabase
    // Auth — si lo bajamos, el server lo rechaza igual.
    const nueva = passForm.nueva
    if (nueva.length < 8) {
      setErrorPass('La contraseña nueva tiene que tener al menos 8 caracteres.')
      return
    }
    if (nueva !== passForm.confirm) {
      setErrorPass('Las contraseñas no coinciden.')
      return
    }
    // Recomendaciones sutiles (no bloqueantes): mayus + minus + numero.
    // Sugerencias en hint del UI, no enforced.

    setSavingPass(true)
    try {
      const { error: errSb } = await supabase.auth.updateUser({ password: nueva })
      if (errSb) throw errSb
      setSavedPass(true)
      setPassForm({ nueva: '', confirm: '' })
      setTimeout(() => setSavedPass(false), 3500)
    } catch (err) {
      setErrorPass(err.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setSavingPass(false)
    }
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

      {/* ── Cambio de contraseña ─────────────────────────────
          Form independiente (fuera del form principal) para que el
          submit no se confunda. Usa supabase.auth.updateUser() directo
          — no pasa por el backend porque la session activa ya es prueba
          de identidad suficiente. */}
      <form className={styles.form} onSubmit={handleChangePassword} noValidate>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Seguridad</legend>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="passNueva">Contraseña nueva</label>
              <div className={styles.passwordWrapper}>
                <input id="passNueva" type={mostrarPass.nueva ? 'text' : 'password'}
                  className={styles.input}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={passForm.nueva}
                  onChange={e => setPassForm(f => ({ ...f, nueva: e.target.value }))} />
                <button type="button" className={styles.togglePassword}
                  onClick={() => setMostrarPass(s => ({ ...s, nueva: !s.nueva }))}
                  title={mostrarPass.nueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={mostrarPass.nueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {mostrarPass.nueva ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                </button>
              </div>
              <span className={styles.hint}>
                Recomendado: 12+ caracteres con mayúsculas, minúsculas, números y símbolos.
              </span>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="passConfirm">Confirmar contraseña nueva</label>
              <div className={styles.passwordWrapper}>
                <input id="passConfirm" type={mostrarPass.confirm ? 'text' : 'password'}
                  className={styles.input}
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña nueva"
                  value={passForm.confirm}
                  onChange={e => setPassForm(f => ({ ...f, confirm: e.target.value }))} />
                <button type="button" className={styles.togglePassword}
                  onClick={() => setMostrarPass(s => ({ ...s, confirm: !s.confirm }))}
                  title={mostrarPass.confirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={mostrarPass.confirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {mostrarPass.confirm ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        {errorPass && <div className={styles.errorBanner}>⚠ {errorPass}</div>}
        {savedPass && <div className={styles.savedBanner}>✓ Contraseña cambiada. La próxima vez que cierres sesión, usá la nueva.</div>}

        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={savingPass}>
            {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}
