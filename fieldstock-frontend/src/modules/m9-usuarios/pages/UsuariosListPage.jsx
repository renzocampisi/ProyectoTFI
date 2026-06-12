// src/modules/m9-usuarios/pages/UsuariosListPage.jsx
/**
 * Lista de usuarios — solo DUEÑO (guard a nivel router).
 *
 * Acciones: crear (modal), editar (modal), desactivar (confirm).
 * El crear devuelve la password generada, que se muestra en
 * PasswordRevealModal después del éxito.
 */
import { useState } from 'react'
import { useUsuarios } from '../hooks/useUsuarios'
import { UsuariosService } from '../services/usuarios.service'
import { ROLE_LABELS } from '@shared/constants/roles'
import { useAuth } from '@shared/hooks/useAuth'
import UsuarioFormModal from '../components/UsuarioFormModal'
import PasswordRevealModal from '../components/PasswordRevealModal'
import styles from './UsuariosListPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function UsuariosListPage() {
  const { usuarios, loading, error, refetch } = useUsuarios()
  const { profile } = useAuth()

  // Estado de modales
  const [showForm, setShowForm] = useState(false)        // create
  const [editando, setEditando] = useState(null)         // user en edición (o null)
  const [reveal,   setReveal]   = useState(null)         // { usuario, passwordPlano, modo? } — post-create o post-reset
  const [confDesact, setConfDesact] = useState(null)     // confirm desactivar
  const [errDesact,  setErrDesact]  = useState(null)
  const [confReset,  setConfReset]  = useState(null)     // confirm reset password
  const [errReset,   setErrReset]   = useState(null)
  const [loadingReset, setLoadingReset] = useState(false)

  const handleCreated = (result) => {
    setShowForm(false)
    setReveal({ ...result, modo: 'create' })  // dispara el modal de password
    refetch()
  }
  const handleUpdated = () => {
    setEditando(null)
    refetch()
  }
  const handleDesactivar = async () => {
    if (!confDesact) return
    setErrDesact(null)
    try {
      await UsuariosService.desactivar(confDesact.id)
      setConfDesact(null)
      refetch()
    } catch (err) { setErrDesact(err.message) }
  }
  // Reset password: confirma → backend autogenera → revela en modal.
  // No persistimos la nueva password en ningún lado — solo se muestra UNA VEZ.
  const handleResetPassword = async () => {
    if (!confReset || loadingReset) return
    setErrReset(null)
    setLoadingReset(true)
    try {
      const { passwordPlano } = await UsuariosService.resetPassword(confReset.id)
      setConfReset(null)
      setReveal({ usuario: confReset, passwordPlano, modo: 'reset' })
    } catch (err) {
      setErrReset(err.message)
    } finally {
      setLoadingReset(false)
    }
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios del sistema</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
          + Nuevo usuario
        </button>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          <span className={styles.spinner} /> Cargando usuarios...
        </div>
      )}

      {!loading && !error && usuarios.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>👥</span>
          <p>Todavía no hay usuarios cargados.</p>
        </div>
      )}

      {!loading && !error && usuarios.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const esYo = u.id === profile?.id
                return (
                  <tr key={u.id} className={styles.row}>
                    <td className={styles.cellNombre}>
                      {u.nombre}
                      {esYo && <span className={styles.tagYo}>vos</span>}
                    </td>
                    <td className={styles.cellEmail}>{u.email}</td>
                    <td><span className={styles.role}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td className={styles.cellTel}>{u.telefono || '—'}</td>
                    <td>
                      {u.activo
                        ? <span className={styles.estadoActivo}>Activo</span>
                        : <span className={styles.estadoInactivo}>Desactivado</span>
                      }
                    </td>
                    <td className={styles.cellFecha}>{formatFecha(u.created_at)}</td>
                    <td className={styles.actions}>
                      <button className={styles.btnRow} onClick={() => setEditando(u)}>
                        Editar
                      </button>
                      {u.activo && !esYo && (
                        <button className={styles.btnReset} onClick={() => setConfReset(u)}
                          title="Resetear contraseña">
                          🔑
                        </button>
                      )}
                      {u.activo && !esYo && (
                        <button className={styles.btnDesact} onClick={() => setConfDesact(u)}
                          title="Desactivar usuario">
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      {showForm && (
        <UsuarioFormModal
          onClose={() => setShowForm(false)}
          onCreated={handleCreated} />
      )}
      {editando && (
        <UsuarioFormModal
          usuario={editando}
          onClose={() => setEditando(null)}
          onUpdated={handleUpdated} />
      )}
      {reveal && (
        <PasswordRevealModal
          usuario={reveal.usuario}
          passwordPlano={reveal.passwordPlano}
          titulo={reveal.modo === 'reset' ? 'Contraseña reseteada' : 'Usuario creado'}
          passLabel={reveal.modo === 'reset' ? 'Nueva contraseña' : 'Contraseña generada'}
          onClose={() => setReveal(null)} />
      )}

      {confReset && (
        <div className={styles.confirmOverlay} onClick={() => !loadingReset && setConfReset(null)}>
          <div className={styles.confirmCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>¿Resetear contraseña?</h3>
            <p className={styles.confirmText}>
              Se va a generar una contraseña nueva para <strong>{confReset.nombre}</strong> ({confReset.email}).
              La contraseña anterior dejará de funcionar de inmediato.
            </p>
            {errReset && <p className={styles.errorBanner}>⚠ {errReset}</p>}
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost}
                onClick={() => { setConfReset(null); setErrReset(null) }}
                disabled={loadingReset}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={handleResetPassword} disabled={loadingReset}>
                {loadingReset ? 'Generando...' : 'Sí, generar nueva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confDesact && (
        <div className={styles.confirmOverlay} onClick={() => setConfDesact(null)}>
          <div className={styles.confirmCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>¿Desactivar usuario?</h3>
            <p className={styles.confirmText}>
              <strong>{confDesact.nombre}</strong> ({confDesact.email}) no va a poder
              ingresar al sistema. Se puede reactivar después editando su perfil.
            </p>
            {errDesact && <p className={styles.errorBanner}>⚠ {errDesact}</p>}
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => { setConfDesact(null); setErrDesact(null) }}>
                Cancelar
              </button>
              <button className={styles.btnDanger} onClick={handleDesactivar}>
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
