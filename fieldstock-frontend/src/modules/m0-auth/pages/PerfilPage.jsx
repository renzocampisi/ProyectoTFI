// src/modules/m0-auth/pages/PerfilPage.jsx
/**
 * Página "Mi perfil" — accesible para cualquier rol. Permite editar el
 * propio nombre y teléfono. Email y rol son read-only (cambiar email
 * va por flujo de Supabase Auth, cambiar rol lo hace el DUEÑO desde
 * /usuarios).
 *
 * El cambio de contraseña se dispara desde acá pero se resuelve por mail
 * (ver el comentario del handler) — cualquier usuario puede cambiar la
 * suya, sin importar el rol.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  // Va por mail, no por un form directo. Antes se cambiaba en el acto con
  // supabase.auth.updateUser() apoyándose en que la sesión activa ya es
  // prueba de identidad — pero en este contexto (PCs compartidas en el
  // depósito, sesiones que quedan abiertas) eso deja que cualquiera que
  // agarre la máquina cambie la contraseña sin conocer la anterior.
  // Mandar el link exige además acceso a la casilla.
  //
  // Reusa el mismo flujo que "Olvidé mi contraseña" del login: Supabase
  // manda el mail y el link cae en /restablecer-password.
  const [enviandoMail, setEnviandoMail] = useState(false)
  const [mailEnviado,  setMailEnviado]  = useState(false)
  const [errorPass,    setErrorPass]    = useState(null)

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

  const handleEnviarMailPassword = async () => {
    if (enviandoMail) return
    setErrorPass(null); setMailEnviado(false); setEnviandoMail(true)
    try {
      const { error: errSb } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/restablecer-password`,
      })
      if (errSb) throw errSb
      setMailEnviado(true)
    } catch (err) {
      setErrorPass(err.message || 'No se pudo enviar el mail. Reintentá en un momento.')
    } finally {
      setEnviandoMail(false)
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
          Por mail, no con un form acá: ver el comentario del handler.
          Disponible para cualquier rol — es la propia cuenta. */}
      <section className={styles.form}>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Seguridad</legend>
          <div className={styles.fields}>
            <div className={styles.field}>
              <span className={styles.label}>Contraseña</span>
              <p className={styles.hint}>
                Te mandamos un mail a <strong>{profile.email}</strong> con un
                link para elegir una contraseña nueva. Es el mismo flujo que
                "Olvidé mi contraseña" del login — así nadie que agarre tu
                sesión abierta puede cambiarla sin acceso a tu casilla.
              </p>
            </div>
          </div>
        </fieldset>

        {errorPass && <div className={styles.errorBanner}>⚠ {errorPass}</div>}
        {mailEnviado && (
          <div className={styles.savedBanner}>
            ✓ Listo, revisá {profile.email} (y la carpeta de spam). El link vence en una hora.
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary}
            onClick={handleEnviarMailPassword} disabled={enviandoMail}>
            {enviandoMail ? 'Enviando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </section>
    </div>
  )
}
