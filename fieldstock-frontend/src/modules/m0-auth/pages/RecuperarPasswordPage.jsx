// src/modules/m0-auth/pages/RecuperarPasswordPage.jsx
/**
 * Página pública "Olvidé mi contraseña" — self-service, sin pasar por
 * el backend: usa directo supabase.auth.resetPasswordForEmail() con la
 * anon key. Distinto del reset administrativo (issue #52), que un DUEÑO/
 * ADMIN dispara desde /usuarios vía el backend con la service key.
 *
 * El mensaje de éxito es SIEMPRE el mismo exista o no el email en el
 * sistema (mismo criterio anti-enumeración que LoginPage) — Supabase ya
 * se comporta así por defecto, no hace falta lógica extra acá.
 *
 * redirectTo apunta a /restablecer-password en este mismo origin: no
 * hace falta una env var nueva, `window.location.origin` ya resuelve
 * correcto tanto en dev como en producción.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@shared/utils/supabaseClient'
import styles from './LoginPage.module.css'

export default function RecuperarPasswordPage() {
  const navigate = useNavigate()
  const [email,      setEmail]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,       setError]     = useState(null)
  const [enviado,     setEnviado]   = useState(false)

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!email.trim()) {
      setError('Ingresá tu email.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer-password`,
      })
    } catch (err) {
      // No mostramos el error real (podría filtrar si el email existe o
      // no) — solo lo logueamos para diagnóstico.
      // eslint-disable-next-line no-console
      console.error('[RecuperarPassword] error:', err)
    } finally {
      // Siempre "enviado", exista o no la cuenta — anti-enumeración.
      setEnviado(true)
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" className={styles.brandIcon} />
          <span className={styles.logo}>FieldStock AI</span>
          <span className={styles.tagline}>Recuperar contraseña</span>
        </div>

        {enviado ? (
          <>
            <p className={styles.hint}>
              Si <strong>{email.trim()}</strong> tiene una cuenta, te mandamos un
              mail con un link para elegir una contraseña nueva. Revisá también
              la carpeta de spam.
            </p>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/login')}>
              Volver al login
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username"
                className={styles.input}
                placeholder="tu@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)}
                disabled={submitting}
                autoFocus />
            </div>

            {error && <div className={styles.error}>⚠ {error}</div>}

            <button type="submit" className={styles.btnPrimary} disabled={submitting}
              style={{ marginTop: 'var(--space-4)' }}>
              {submitting ? 'Enviando...' : 'Mandarme el link'}
            </button>

            <button type="button" className={styles.btnLink} onClick={() => navigate('/login')}
              disabled={submitting}>
              Volver al login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
