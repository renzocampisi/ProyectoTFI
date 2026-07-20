// src/modules/m0-auth/pages/RegistroPage.jsx
/**
 * Registro self-service. Sistema single-tenant: no hay alta libre, solo
 * dos caminos posibles (ver auth-publico.service.js en el backend):
 *
 *   - Bootstrap: si todavía no existe ningún usuario en la instancia, este
 *     registro es el DUEÑO y carga junto los datos de su empresa.
 *   - Invitado: si ya hay un dueño, hace falta un código de invitación
 *     vigente (generado desde /usuarios) — se puede prellenar via
 *     ?codigo=XXX en la URL del link que el dueño comparte.
 *
 * El camino se decide con GET /auth/estado al montar. Tras un registro
 * exitoso, hacemos signIn() con las credenciales recién creadas — el
 * listener de useAuth carga el perfil solo, no hace falta nada más acá.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { RegistroService } from '../services/registro.service'
import styles from './LoginPage.module.css'

export default function RegistroPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile, loading: loadingAuth, signIn } = useAuth()

  const [estadoCargado, setEstadoCargado] = useState(false)
  const [hayUsuarios,   setHayUsuarios]   = useState(true)
  const [errEstado,     setErrEstado]     = useState(null)

  const [form, setForm] = useState({
    nombre: '', email: '', password: '', telefono: '',
    codigo: searchParams.get('codigo') || '',
    empresaNombre: '', empresaTelefono: '', empresaDireccion: '', empresaEmail: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    RegistroService.getEstado()
      .then(data => setHayUsuarios(data.hayUsuarios))
      .catch(err => setErrEstado(err.message))
      .finally(() => setEstadoCargado(true))
  }, [])

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  if (loadingAuth || !estadoCargado) return null
  if (user && profile) return <Navigate to="/" replace />

  const esBootstrap = !hayUsuarios

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (submitting) return

    if (!form.nombre.trim() || !form.email.trim() || !form.password) {
      setError('Completá nombre, email y contraseña.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!esBootstrap && !form.codigo.trim()) {
      setError('Necesitás un código de invitación para registrarte.')
      return
    }
    if (esBootstrap && !form.empresaNombre.trim()) {
      setError('Ingresá el nombre de tu empresa.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (esBootstrap) {
        await RegistroService.registrarDueño({
          email: form.email.trim(), password: form.password,
          nombre: form.nombre.trim(), telefono: form.telefono.trim() || undefined,
          empresa: {
            nombre: form.empresaNombre.trim(),
            telefono: form.empresaTelefono.trim(),
            direccion: form.empresaDireccion.trim(),
            email: form.empresaEmail.trim(),
          },
        })
      } else {
        await RegistroService.registrarConInvitacion({
          codigo: form.codigo.trim(), email: form.email.trim(), password: form.password,
          nombre: form.nombre.trim(), telefono: form.telefono.trim() || undefined,
        })
      }

      const { error: errAuth } = await signIn(form.email.trim(), form.password)
      if (errAuth) {
        // Se creó la cuenta pero el auto-login falló (raro) — mandamos a
        // /login para que entre manualmente en vez de dejarlo colgado acá.
        navigate('/login', { replace: true })
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'No se pudo completar el registro.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" className={styles.brandIcon} />
          <span className={styles.logo}>FieldStock AI</span>
          <span className={styles.tagline}>
            {esBootstrap ? 'Creá tu cuenta de dueño' : 'Completá tu registro'}
          </span>
        </div>

        {errEstado && <div className={styles.error}>⚠ {errEstado}</div>}

        {!esBootstrap && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="codigo">Código de invitación</label>
            <input id="codigo" type="text" className={styles.input}
              placeholder="FS-INV-XXXXXX"
              value={form.codigo} onChange={set('codigo')}
              disabled={submitting} autoFocus />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="nombre">Tu nombre</label>
          <input id="nombre" type="text" className={styles.input}
            placeholder="Juan Pérez"
            value={form.nombre} onChange={set('nombre')}
            disabled={submitting} autoFocus={esBootstrap} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" className={styles.input}
            placeholder="tu@empresa.com"
            value={form.email} onChange={set('email')}
            disabled={submitting} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="new-password" className={styles.input}
            placeholder="Mínimo 8 caracteres"
            value={form.password} onChange={set('password')}
            disabled={submitting} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="telefono">Teléfono (opcional)</label>
          <input id="telefono" type="tel" className={styles.input}
            placeholder="+54 9 341 ..."
            value={form.telefono} onChange={set('telefono')}
            disabled={submitting} />
        </div>

        {esBootstrap && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="empresaNombre">Nombre de la empresa</label>
              <input id="empresaNombre" type="text" className={styles.input}
                placeholder="Ej: Construcciones Campisi S.A."
                value={form.empresaNombre} onChange={set('empresaNombre')}
                disabled={submitting} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="empresaTelefono">Teléfono de la empresa (opcional)</label>
              <input id="empresaTelefono" type="tel" className={styles.input}
                value={form.empresaTelefono} onChange={set('empresaTelefono')}
                disabled={submitting} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="empresaDireccion">Dirección (opcional)</label>
              <input id="empresaDireccion" type="text" className={styles.input}
                value={form.empresaDireccion} onChange={set('empresaDireccion')}
                disabled={submitting} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="empresaEmail">Email de la empresa (opcional)</label>
              <input id="empresaEmail" type="email" className={styles.input}
                value={form.empresaEmail} onChange={set('empresaEmail')}
                disabled={submitting} />
            </div>
          </>
        )}

        {error && <div className={styles.error}>⚠ {error}</div>}

        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <button type="button" className={styles.btnLink}
          onClick={() => navigate('/login')}
          disabled={submitting}>
          ¿Ya tenés cuenta? Iniciar sesión
        </button>
      </form>
    </div>
  )
}
