// src/modules/m0-auth/pages/LoginPage.jsx
/**
 * Página de login — dos pasos para todo rol salvo ADMIN
 * (ver _plans/login-2fl/):
 *
 *   1. credenciales: email + contraseña. El backend verifica la contraseña
 *      server-side. Si es el ADMIN, entra directo. Si es cualquier otro
 *      rol, manda un código de 6 dígitos al mail y pasamos al paso 2.
 *   2. codigo: el usuario tipea el código; verifyOtp lo canjea por sesión.
 *
 * Si ya hay sesión activa, redirige a `/` (o al `from` que venga del state
 * de navegación, en caso de que ProtectedRoute haya capturado la URL
 * destino antes de patear acá).
 *
 * Mensaje de error genérico en el paso 1: no diferenciamos entre "email no
 * existe" y "password mala" para no facilitar enumeración de usuarios.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '@shared/hooks/useAuth'
import { clearSupabaseStorage } from '@shared/utils/supabaseClient'
import styles from './LoginPage.module.css'

const COOLDOWN_REENVIO = 60

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading, signIn, verificarCodigo } = useAuth()

  const [paso, setPaso] = useState('credenciales') // 'credenciales' | 'codigo'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [codigo,   setCodigo]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,    setError]    = useState(null)
  const [aviso,    setAviso]    = useState(null)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [confiar, setConfiar] = useState(true)
  const codigoInputRef = useRef(null)

  // Cuenta regresiva del botón "Reenviar código".
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Al entrar al paso de código, foco directo en el input.
  useEffect(() => {
    if (paso === 'codigo') codigoInputRef.current?.focus()
  }, [paso])

  // Si está cargando la sesión inicial, no renderizamos para evitar
  // el flash de "form de login" en quien ya está logueado.
  if (loading) return null

  // Ya autenticado → fuera de acá. Respetar `from` si lo trajo el guard.
  if (user && profile) {
    const dest = location.state?.from?.pathname || '/'
    return <Navigate to={dest} replace />
  }

  const handleSubmitCredenciales = async (ev) => {
    ev.preventDefault()
    if (!email.trim() || !password) {
      setError('Ingresá email y contraseña.')
      return
    }
    setSubmitting(true)
    setError(null)
    setAviso(null)
    try {
      const res = await signIn(email.trim(), password)
      if (res.error) {
        setError(res.error.message || 'Email o contraseña incorrectos.')
        return
      }
      if (res.requiereCodigo) {
        setPaso('codigo')
        setCooldown(COOLDOWN_REENVIO)
        return
      }
      // Sesión seteada (ADMIN): el <Navigate> de arriba redirige en el
      // próximo render. Fallback por si el evento no llega.
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo iniciar sesión. Reintentá en unos segundos.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitCodigo = async (ev) => {
    ev.preventDefault()
    const limpio = codigo.replace(/\D/g, '')
    if (limpio.length !== 6) {
      setError('El código tiene 6 dígitos.')
      return
    }
    setSubmitting(true)
    setError(null)
    setAviso(null)
    try {
      const res = await verificarCodigo(email.trim(), limpio, confiar)
      if (res.error) {
        setError(res.error.message || 'El código no es válido o venció.')
        return
      }
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo verificar el código. Reintentá en unos segundos.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReenviar = async () => {
    if (cooldown > 0 || submitting) return
    setSubmitting(true)
    setError(null)
    setAviso(null)
    try {
      const res = await signIn(email.trim(), password)
      if (res.error) {
        setError(res.error.message || 'No se pudo reenviar el código.')
        return
      }
      setCooldown(COOLDOWN_REENVIO)
      setAviso('Te mandamos un código nuevo.')
    } catch {
      setError('No se pudo reenviar el código. Reintentá en unos segundos.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVolver = () => {
    setPaso('credenciales')
    setCodigo('')
    setPassword('')
    setError(null)
    setAviso(null)
    setCooldown(0)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" className={styles.brandIcon} />
          <span className={styles.logo}>FieldStock AI</span>
          <span className={styles.tagline}>Gestión de inventario de obra</span>
        </div>

        {paso === 'credenciales' ? (
          <form className={styles.form} onSubmit={handleSubmitCredenciales} noValidate>
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

            <button type="button" className={styles.btnLink}
              onClick={() => navigate('/recuperar-password')}
              disabled={submitting}>
              ¿Olvidaste tu contraseña?
            </button>

            <p className={styles.hint}>
              Si no tenés cuenta, pedile al dueño que te cree una.
            </p>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleSubmitCodigo} noValidate>
            <p className={styles.hint}>
              Te mandamos un código de 6 dígitos a <strong>{email.trim()}</strong>.
              Revisá también la carpeta de spam.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="codigo">Código</label>
              <input id="codigo" ref={codigoInputRef}
                type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]*" maxLength={6}
                className={`${styles.input} ${styles.codeInput}`}
                placeholder="000000"
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={submitting} />
            </div>

            <label className={styles.checkboxRow}>
              <input type="checkbox"
                checked={confiar}
                onChange={e => setConfiar(e.target.checked)}
                disabled={submitting} />
              Confiar en este dispositivo
            </label>

            {error && <div className={styles.error}>⚠ {error}</div>}
            {aviso && <div className={styles.aviso}>✓ {aviso}</div>}

            <button type="submit" className={styles.btnPrimary}
              disabled={submitting || codigo.length !== 6}>
              {submitting ? 'Verificando...' : 'Verificar'}
            </button>

            <div className={styles.resendRow}>
              <button type="button" className={styles.btnLink}
                onClick={handleReenviar}
                disabled={submitting || cooldown > 0}>
                {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
              </button>
              <button type="button" className={styles.btnLink}
                onClick={handleVolver} disabled={submitting}>
                Volver
              </button>
            </div>
          </form>
        )}

        {/* Auto-servicio para el bug del 29/05: si por algún motivo edge
            la sesión cacheada queda corrupta y la limpieza automática
            no dispara, el user puede forzarla con este botón y reintentar. */}
        <button type="button"
          className={styles.btnReset}
          onClick={() => {
            clearSupabaseStorage()
            window.location.reload()
          }}>
          ¿Problemas para entrar? Limpiar sesión y reintentar
        </button>
      </div>
    </div>
  )
}
