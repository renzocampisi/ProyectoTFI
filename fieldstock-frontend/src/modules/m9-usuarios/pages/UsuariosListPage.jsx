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
import { ROLE_LABELS, esAdminEstricto } from '@shared/constants/roles'
import { useAuth } from '@shared/hooks/useAuth'
import { useOrdenAlfabetico } from '@shared/hooks/useOrdenAlfabetico'
import UsuarioFormModal from '../components/UsuarioFormModal'
import PasswordRevealModal from '../components/PasswordRevealModal'
import InvitarModal from '../components/InvitarModal'
import styles from './UsuariosListPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function UsuariosListPage() {
  const { usuarios, loading, error, refetch } = useUsuarios()
  const { profile } = useAuth()
  // El DUEÑO administra a su propio equipo ("Empleados"); el ADMIN (dueño
  // del sistema) todavía ve "Usuarios" — la vista cross-empresa por ahora
  // muestra los mismos datos de esta instancia, a la espera de esa feature.
  const esAdmin = esAdminEstricto(profile?.role)
  const etiquetaSingular = esAdmin ? 'usuario' : 'empleado'

  // Estado de modales
  const [showForm, setShowForm] = useState(false)        // create
  const [showInvitar, setShowInvitar] = useState(false)  // invitar empleado
  const [editando, setEditando] = useState(null)         // user en edición (o null)
  const [detalle,  setDetalle]  = useState(null)         // user a mostrar en el modal de Detalles
  const [reveal,   setReveal]   = useState(null)         // { usuario, passwordPlano, modo? } — post-create o post-reset
  const [confDesact, setConfDesact] = useState(null)     // confirm desactivar
  const [errDesact,  setErrDesact]  = useState(null)
  const [confReset,  setConfReset]  = useState(null)     // confirm reset password
  const [errReset,   setErrReset]   = useState(null)
  const [loadingReset, setLoadingReset] = useState(false)
  // Nueva contraseña a elección (solo para el ADMIN): solo DUEÑO/ADMIN llegan
  // a esta pantalla (guard de router), así que ya queda acotado a "vos".
  const [nuevaPassAdmin,   setNuevaPassAdmin]   = useState(null) // usuario admin objetivo
  const [passInput,        setPassInput]        = useState('')
  const [errNuevaPass,     setErrNuevaPass]     = useState(null)
  const [loadingNuevaPass, setLoadingNuevaPass] = useState(false)

  const {
    listaOrdenada: usuariosOrdenados,
    orden, toggleOrden, IconoOrden, labelOrden,
  } = useOrdenAlfabetico(usuarios, u => u.nombre)

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

  // Nueva contraseña a elección del ADMIN — mismo endpoint que el reset
  // automático, pero mandando la password elegida en vez de dejar que el
  // backend la autogenere.
  const handleGuardarNuevaPass = async () => {
    if (!nuevaPassAdmin || loadingNuevaPass) return
    const pass = passInput.trim()
    if (pass.length < 8) {
      setErrNuevaPass('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setErrNuevaPass(null)
    setLoadingNuevaPass(true)
    try {
      await UsuariosService.resetPassword(nuevaPassAdmin.id, pass)
      setNuevaPassAdmin(null)
      setPassInput('')
    } catch (err) {
      setErrNuevaPass(err.message)
    } finally {
      setLoadingNuevaPass(false)
    }
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{esAdmin ? 'Usuarios del sistema' : 'Empleados'}</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${usuarios.length} ${etiquetaSingular}${usuarios.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={() => setShowInvitar(true)}>
            Invitar
          </button>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
            + Nuevo {etiquetaSingular}
          </button>
        </div>
      </div>

      {!loading && !error && usuarios.length > 0 && (
        <div className={styles.toolbar}>
          <button
            className={`${styles.btnGhost} ${styles.btnOrden} ${orden !== 'ninguno' ? styles.chipActive : ''}`}
            onClick={toggleOrden}
            title="Ordenar alfabéticamente"
          >
            <IconoOrden size={14} /> {labelOrden}
          </button>
        </div>
      )}

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
                <th>Nombre completo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className={styles.thFecha}>Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuariosOrdenados.map(u => {
                const esYo = u.id === profile?.id
                // El usuario ADMIN es la cuenta especial del dueño del sistema
                // para probar funciones sin restricciones — no tiene sentido
                // ver detalles ni editarla desde esta lista.
                const esUsuarioAdmin = u.role === 'ADMIN'
                return (
                  <tr key={u.id} className={styles.row}>
                    <td className={styles.cellNombre}>
                      {u.nombre}
                      {esYo && <span className={styles.tagYo}>vos</span>}
                    </td>
                    <td><span className={styles.role}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td>
                      {u.activo
                        ? <span className={styles.estadoActivo}>Activo</span>
                        : <span className={styles.estadoInactivo}>Desactivado</span>
                      }
                    </td>
                    <td className={styles.cellFecha}>{formatFecha(u.created_at)}</td>
                    <td className={styles.actions}>
                      {!esUsuarioAdmin && (
                        <button className={styles.btnRow} onClick={() => setDetalle(u)}>
                          Detalles
                        </button>
                      )}
                      {!esUsuarioAdmin && (
                        <button className={styles.btnRow} onClick={() => setEditando(u)}>
                          Editar
                        </button>
                      )}
                      {/* El Admin conserva la llave incluso siendo "vos": es la
                          cuenta especial de verificación y necesitás poder
                          recuperarla si te olvidás la contraseña. Solo
                          DUEÑO/ADMIN llegan a esta pantalla, así que ya
                          está acotado a vos. */}
                      {u.activo && (esUsuarioAdmin || !esYo) && (
                        <button className={styles.btnReset} onClick={() => setConfReset(u)}
                          title="Resetear contraseña (genera una al azar)">
                          🔑
                        </button>
                      )}
                      {u.activo && esUsuarioAdmin && (
                        <button className={styles.btnRow}
                          onClick={() => { setNuevaPassAdmin(u); setPassInput(''); setErrNuevaPass(null) }}>
                          Nueva contraseña
                        </button>
                      )}
                      {u.activo && !esUsuarioAdmin && !esYo && (
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
      {detalle && (
        <div className={styles.confirmOverlay} onClick={() => setDetalle(null)}>
          <div className={styles.confirmCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>{detalle.nombre}</h3>
            <div className={styles.detalleGrid}>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>Email</span>
                <span className={styles.detalleValue}>{detalle.email || '—'}</span>
              </div>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>Teléfono</span>
                <span className={styles.detalleValue}>{detalle.telefono || '—'}</span>
              </div>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>DNI</span>
                <span className={styles.detalleValue}>{detalle.dni || '—'}</span>
              </div>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>Dirección</span>
                <span className={styles.detalleValue}>{detalle.direccion || '—'}</span>
              </div>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>Rol</span>
                <span className={styles.detalleValue}>{ROLE_LABELS[detalle.role] || detalle.role}</span>
              </div>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>Estado</span>
                <span className={styles.detalleValue}>{detalle.activo ? 'Activo' : 'Desactivado'}</span>
              </div>
              <div className={styles.detalleRow}>
                <span className={styles.detalleLabel}>Alta</span>
                <span className={styles.detalleValue}>{formatFecha(detalle.created_at)}</span>
              </div>
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

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
      {showInvitar && (
        <InvitarModal onClose={() => setShowInvitar(false)} />
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

      {nuevaPassAdmin && (
        <div className={styles.confirmOverlay} onClick={() => !loadingNuevaPass && setNuevaPassAdmin(null)}>
          <div className={styles.confirmCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Nueva contraseña para {nuevaPassAdmin.nombre}</h3>
            <p className={styles.confirmText}>
              Elegí la contraseña nueva. La anterior deja de funcionar de inmediato.
            </p>
            <input
              type="text"
              className={styles.input}
              placeholder="Mínimo 8 caracteres"
              value={passInput}
              onChange={e => setPassInput(e.target.value)}
              disabled={loadingNuevaPass}
              autoFocus
            />
            {errNuevaPass && <p className={styles.errorBanner}>⚠ {errNuevaPass}</p>}
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost}
                onClick={() => { setNuevaPassAdmin(null); setErrNuevaPass(null) }}
                disabled={loadingNuevaPass}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={handleGuardarNuevaPass} disabled={loadingNuevaPass}>
                {loadingNuevaPass ? 'Guardando...' : 'Guardar'}
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
