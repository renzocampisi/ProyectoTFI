// src/modules/m0-auth/pages/RestablecerPasswordPage.jsx
/**
 * Página pública a la que Supabase redirige tras click en el mail de
 * "recuperar contraseña" (link con #access_token=...&type=recovery en
 * el hash). El cliente de supabase tiene detectSessionInUrl:true (ver
 * supabaseClient.js), así que ese hash ya se procesó y hay una sesión
 * de tipo "recovery" activa antes de que este componente monte.
 *
 * No depende de useAuth()/AuthContext a propósito: esa sesión de
 * recovery NO carga `profile` (el AuthProvider no maneja el evento
 * PASSWORD_RECOVERY), así que cualquier guard basado en profile
 * bloquearía esta página. Acá se chequea la sesión directo con
 * supabase.auth.getSession().
 *
 * Tras cambiar la contraseña, cerramos sesión a propósito (signOut) y
 * mandamos al login — más simple y predecible que dejar al user
 * "logueado" con la sesión de recovery, que además nunca tuvo el
 * perfil del backend cargado.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@shared/utils/supabaseClient'
import styles from './LoginPage.module.css'

export default function RestablecerPasswordPage() {
  const navigate = useNavigate()
  const [checking,  setChecking]  = useState(true)
  const [sesionOk,  setSesionOk]  = useState(false)
  const [nueva,     setNueva]     = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]     = useState(null)
  const [listo,     setListo]     = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSesionOk(!!data?.session)
        setChecking(false)
      }
    })
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setError(null)
    if (nueva.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.')
      return
    }
    if (nueva !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      const { error: errSb } = await supabase.auth.updateUser({ password: nueva })
      if (errSb) throw errSb
      setListo(true)
      await supabase.auth.signOut()
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña. El link puede haber expirado.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) return null

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" className={styles.brandIcon} />
          <span className={styles.logo}>FieldStock AI</span>
          <span className={styles.tagline}>Elegir nueva contraseña</span>
        </div>

        {listo ? (
          <>
            <p className={styles.hint}>✓ Contraseña actualizada. Ya podés iniciar sesión con la nueva.</p>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/login')}>
              Ir al login
            </button>
          </>
        ) : !sesionOk ? (
          <>
            <p className={styles.hint}>
              Este link ya no es válido o expiró. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".
            </p>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/recuperar-password')}>
              Pedir un link nuevo
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="nueva">Contraseña nueva</label>
              <input id="nueva" type="password" autoComplete="new-password"
                className={styles.input}
                placeholder="Mínimo 8 caracteres"
                value={nueva} onChange={e => setNueva(e.target.value)}
                disabled={submitting}
                autoFocus />
            </div>

            <div className={styles.field} style={{ marginTop: 'var(--space-4)' }}>
              <label className={styles.label} htmlFor="confirm">Confirmar contraseña</label>
              <input id="confirm" type="password" autoComplete="new-password"
                className={styles.input}
                placeholder="Repetí la contraseña nueva"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                disabled={submitting} />
            </div>

            {error && <div className={styles.error} style={{ marginTop: 'var(--space-4)' }}>⚠ {error}</div>}

            <button type="submit" className={styles.btnPrimary} disabled={submitting}
              style={{ marginTop: 'var(--space-4)' }}>
              {submitting ? 'Guardando...' : 'Guardar contraseña nueva'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
