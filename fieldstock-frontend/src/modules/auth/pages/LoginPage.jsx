import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
    } else {
      navigate('/inventario')
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.logo}>FieldStock</span>
        <span className={styles.logoTag}>AI</span>
      </div>
      <p className={styles.subtitle}>Gestión de inventario de herramientas</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            required
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
