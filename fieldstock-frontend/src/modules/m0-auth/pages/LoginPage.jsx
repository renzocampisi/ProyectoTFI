// src/modules/m0-auth/pages/LoginPage.jsx
/**
 * Página de login — formulario simple email + password.
 *
 * Si ya hay sesión activa, redirige a `/` (o al `from` que venga del state
 * de navegación, en caso de que ProtectedRoute haya capturado la URL
 * destino antes de patear acá).
 *
 * Mensaje de error genérico: "Email o contraseña incorrectos". No
 * diferenciamos entre "email no existe" y "password mala" para no
 * facilitar enumeración de usuarios.
 */
import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '@shared/hooks/useAuth'
import { clearSupabaseStorage } from '@shared/utils/supabaseClient'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading, signIn } = useAuth()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,    setError]    = useState(null)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  // Si está cargando la sesión inicial, no renderizamos para evitar
  // el flash de "form de login" en quien ya está logueado.
  if (loading) return null

  // Ya autenticado → fuera de acá. Respetar `from` si lo trajo el guard.
  if (user && profile) {
    const dest = location.state?.from?.pathname || '/'
    return <Navigate to={dest} replace />
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!email.trim() || !password) {
      setError('Ingresá email y contraseña.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: errAuth } = await signIn(email.trim(), password)
      if (errAuth) {
        // Mensaje genérico para no facilitar enumeración de usuarios.
        // El detalle del error de Supabase queda solo en consola para
        // diagnóstico (útil si bloquean POST/auth, ver issue del 28/05).
        // eslint-disable-next-line no-console
        console.error('[Login] signIn error:', errAuth)
        setError('Email o contraseña incorrectos.')
        return
      }
      // signIn dispara onAuthStateChange → cargarPerfil → user/profile
      // se actualizan. La redirección la hace el Navigate de arriba en
      // el próximo render. Si por algún motivo no llega, forzamos a /.
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo iniciar sesión. Reintentá en unos segundos.')
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
          <span className={styles.tagline}>Gestión de inventario de obra</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username"
            className={styles.input}
            placeholder="tu@empresa.com"
            value={email} onChange={e => setEmail(e.target.value)}
            disabled={submitting}
            autoFocus />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Contraseña</label>
          <div className={styles.passwordWrapper}>
            <input id="password" type={mostrarPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={styles.input}
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              disabled={submitting} />
            <button type="button" className={styles.togglePassword}
              onClick={() => setMostrarPassword(v => !v)}
              disabled={submitting}
              title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {mostrarPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>⚠ {error}</div>}

        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className={styles.hint}>
          Si no tenés cuenta, pedile al dueño que te cree una.
        </p>

        {/* Auto-servicio para el bug del 29/05: si por algún motivo edge
            la sesión cacheada queda corrupta y los limpieza automática
            no dispara, el user puede forzarla con este botón y reintentar.
            Discreto al pie para no llamar la atención en el flow normal. */}
        <button type="button"
          className={styles.btnReset}
          onClick={() => {
            clearSupabaseStorage()
            window.location.reload()
          }}>
          ¿Problemas para entrar? Limpiar sesión y reintentar
        </button>
      </form>
    </div>
  )
}
