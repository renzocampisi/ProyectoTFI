// src/shared/components/RequireAuth.jsx
/**
 * Guard de ruta: si no hay sesión, redirige a /login preservando la URL
 * destino en `location.state.from` para volver después del login exitoso.
 *
 * Excepción: si la URL pedida es exactamente "/" (el link raíz de la app,
 * lo que alguien sin sesión pega en el navegador), redirige a la landing
 * pública (/bienvenida) en vez de a /login — mostrar el login antes de
 * que la persona sepa qué es FieldStock AI no tiene sentido comercial.
 * Cualquier otra ruta privada (ej. /herramientas) sigue yendo a /login
 * como siempre.
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
    if (location.pathname === '/') {
      return <Navigate to="/bienvenida" replace />
    }
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
