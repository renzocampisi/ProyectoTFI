import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import styles from './AuthLayout.module.css'

export default function AuthLayout() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/inventario" replace />

  return (
    <div className={styles.wrapper}>
      <Outlet />
    </div>
  )
}
