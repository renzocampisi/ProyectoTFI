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
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { ROLE_LABELS } from '@shared/constants/roles'
import { supabase } from '@shared/utils/supabaseClient'
import * as trustedDevice from '@shared/utils/trustedDevice'
import { UsuariosService } from '@modules/m9-usuarios/services/usuarios.service'
import { DispositivosConfianzaService } from '../services/dispositivosConfianza.service'
import styles from './PerfilPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

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

  // ── Dispositivos de confianza (ver _plans/dispositivo-confianza/) ──
  const [dispositivos,        setDispositivos]        = useState([])
  const [cargandoDispositivos, setCargandoDispositivos] = useState(true)
  const [revocando,           setRevocando]           = useState(null) // id en curso, o 'todos'
  const [errorDispositivos,   setErrorDispositivos]   = useState(null)
  const idDispositivoActual = trustedDevice.leerToken()?.id

  const cargarDispositivos = useCallback(async () => {
    setCargandoDispositivos(true)
    try {
      const data = await DispositivosConfianzaService.listar()
      setDispositivos(data.filter(d => !d.revocado_at))
    } catch (err) {
      setErrorDispositivos(err.message)
    } finally {
      setCargandoDispositivos(false)
    }
  }, [])

  useEffect(() => { cargarDispositivos() }, [cargarDispositivos])

  const handleRevocarDispositivo = async (id) => {
    if (revocando || !window.confirm('¿Revocar este dispositivo? Su próximo login va a pedir código otra vez.')) return
    setRevocando(id); setErrorDispositivos(null)
    try {
      await DispositivosConfianzaService.revocarUno(id)
      if (id === idDispositivoActual) trustedDevice.borrar()
      await cargarDispositivos()
    } catch (err) {
      setErrorDispositivos(err.message)
    } finally {
      setRevocando(null)
    }
  }

  const handleRevocarTodos = async () => {
    if (revocando || !window.confirm('¿Cerrar sesión de confianza en todos los dispositivos? Todos van a pedir código en su próximo login, incluido este.')) return
    setRevocando('todos'); setErrorDispositivos(null)
    try {
      await DispositivosConfianzaService.revocarTodos()
      trustedDevice.borrar()
      await cargarDispositivos()
    } catch (err) {
      setErrorDispositivos(err.message)
    } finally {
      setRevocando(null)
    }
  }

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

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Dispositivos de confianza</legend>
          <p className={styles.hint}>
            Los equipos donde tildaste "Confiar en este dispositivo" al verificar el
            código. Mientras figuren acá, el login en ese equipo salta el código
            (la contraseña se sigue pidiendo siempre).
          </p>

          {errorDispositivos && <div className={styles.errorBanner}>⚠ {errorDispositivos}</div>}

          {cargandoDispositivos ? (
            <p className={styles.hint}>Cargando...</p>
          ) : dispositivos.length === 0 ? (
            <p className={styles.hint}>No tenés dispositivos de confianza registrados.</p>
          ) : (
            <ul className={styles.dispositivosList}>
              {dispositivos.map(d => (
                <li key={d.id} className={styles.dispositivoRow}>
                  <div>
                    <div className={styles.dispositivoDescripcion}>
                      {d.descripcion || 'Dispositivo'}
                      {d.id === idDispositivoActual && (
                        <span className={styles.chip}>Este dispositivo</span>
                      )}
                    </div>
                    <div className={styles.hint}>Último uso: {formatFecha(d.ultimo_uso)}</div>
                  </div>
                  <button type="button" className={styles.btnDanger}
                    onClick={() => handleRevocarDispositivo(d.id)}
                    disabled={revocando !== null}>
                    {revocando === d.id ? 'Revocando...' : 'Revocar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {dispositivos.length > 0 && (
          <div className={styles.actions}>
            <button type="button" className={styles.btnDanger}
              onClick={handleRevocarTodos} disabled={revocando !== null}>
              {revocando === 'todos' ? 'Cerrando sesiones...' : 'Cerrar sesión en todos los dispositivos'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
