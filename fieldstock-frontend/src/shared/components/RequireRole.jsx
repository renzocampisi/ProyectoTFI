// src/shared/components/RequireRole.jsx
/**
 * Guard de ruta basado en rol — se asume que RequireAuth ya corrió antes
 * (vive en la jerarquía padre).
 *
 * Si el rol del user no está en la lista permitida, renderiza una página
 * 403 simple en vez de redirigir. Mostrar el 403 es mejor UX que un
 * Navigate silencioso: el user entiende que no tiene permisos para algo
 * que existe.
 *
 * Uso:
 *   <Route path="usuarios" element={
 *     <RequireRole roles={[ROLES.DUEÑO]}>
 *       <UsuariosListPage />
 *     </RequireRole>
 *   } />
 */
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'

export default function RequireRole({ roles, children }) {
  const { role } = useAuth()
  const navigate = useNavigate()

  if (!roles.includes(role)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 12,
        textAlign: 'center', padding: '0 24px',
      }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, margin: 0 }}>
          No tenés acceso a esta sección
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: 0 }}>
          Esta página requiere un rol superior. Si pensás que es un error,
          pedile al dueño que revise tus permisos.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 12,
            background: 'var(--color-primary)', color: '#fff',
            padding: '8px 20px', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500,
          }}>
          Volver al inicio
        </button>
      </div>
    )
  }
  return children
}
