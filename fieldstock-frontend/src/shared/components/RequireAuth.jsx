// src/shared/components/RequireAuth.jsx
/**
 * Guard de ruta: si no hay sesión, redirige a /login preservando la URL
 * destino en `location.state.from` para volver después del login exitoso.
 *
 * Mientras `loading` es true (boot inicial del AuthProvider) no renderiza
 * nada — evita un flash de redirect-a-login en cada page load.
 *
 * Uso típico en AppRouter:
 *   <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
 *     ... rutas privadas ...
 *   </Route>
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'

export default function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user || !profile) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
