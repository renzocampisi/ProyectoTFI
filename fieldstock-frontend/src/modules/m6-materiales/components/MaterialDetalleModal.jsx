// src/modules/m6-materiales/components/MaterialDetalleModal.jsx
/**
 * Modal de detalle de un material/insumo (Word #19).
 *
 * Muestra los datos completos del material en una vista de solo lectura
 * con un botón rápido para editar. El precio (último precio agregado)
 * que pedía el item del Word NO se incluye porque el campo aún no
 * existe en el schema; queda pendiente para un PR futuro que agregue
 * tracking de precios.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialesService } from '../services/materiales.service'
import styles from './MaterialDetalleModal.module.css'

// Formato dd/mm/yyyy + hh:mm a partir de un ISO timestamp.
function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}

function estadoStockLabel(actual, minimo) {
  if (actual === 0) return { label: 'Agotado',    cls: styles.estadoAgotado }
  if (actual <= minimo) return { label: 'Stock bajo', cls: styles.estadoBajo }
  return { label: 'OK', cls: styles.estadoOk }
}

export default function MaterialDetalleModal({ material, onClose, onDeleted }) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [error,         setError]         = useState(null)

  if (!material) return null

  const estado = estadoStockLabel(material.stock_actual, material.stock_minimo)

  const handleEliminar = async () => {
    setDeleting(true); setError(null)
    try {
      await MaterialesService.remove(material.id)
      onDeleted?.()  // avisa al padre para refetchear la lista
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el material.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Detalle del material</h3>
          <button className={styles.btnClose} onClick={onClose} title="Cerrar">✕</button>
        </div>

        <div className={styles.body}>

          {/* Encabezado con nombre y badge de estado */}
          <div className={styles.headerRow}>
            <div className={styles.nombre}>{material.nombre}</div>
            <span className={`${styles.estadoBadge} ${estado.cls}`}>{estado.label}</span>
          </div>

          {/* Grid de campos en dos columnas */}
          <dl className={styles.fieldsGrid}>
            <div className={styles.field}>
              <dt className={styles.label}>Marca</dt>
              <dd className={styles.value}>
                {material.marca || <span className={styles.empty}>Sin marca</span>}
              </dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.label}>Unidad</dt>
              <dd className={styles.value}>{material.unidad || '—'}</dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.label}>Stock actual</dt>
              <dd className={styles.value}>
                <strong>{material.stock_actual}</strong> {material.unidad}
              </dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.label}>Stock mínimo</dt>
              <dd className={styles.value}>
                {material.stock_minimo} {material.unidad}
              </dd>
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <dt className={styles.label}>Descripción</dt>
              <dd className={styles.value}>
                {material.descripcion || <span className={styles.empty}>Sin descripción</span>}
              </dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.label}>Creado</dt>
              <dd className={styles.value}>{formatDateTime(material.created_at)}</dd>
            </div>

            <div className={styles.field}>
              <dt className={styles.label}>Última actualización</dt>
              <dd className={styles.value}>{formatDateTime(material.updated_at)}</dd>
            </div>
          </dl>
        </div>

        {error && <div className={styles.errorBanner}>⚠ {error}</div>}

        {/* Confirmación de eliminación (Word #19) — el confirm reemplaza
            las acciones normales para forzar atención del usuario. */}
        {confirmDelete ? (
          <div className={styles.confirmBlock}>
            <p className={styles.confirmText}>
              ¿Eliminar <strong>{material.nombre}</strong> del catálogo? Sale del listado pero queda en remitos viejos para no romper la auditoría.
            </p>
            <div className={styles.actions}>
              <button
                className={styles.btnGhost}
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleEliminar}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              className={styles.btnDangerGhost}
              onClick={() => setConfirmDelete(true)}
              title="Soft delete: el material sale del listado pero la fila queda en la DB"
            >
              🗑 Eliminar
            </button>
            <div className={styles.actionsRight}>
              <button className={styles.btnGhost} onClick={onClose}>Cerrar</button>
              <button
                className={styles.btnPrimary}
                onClick={() => navigate(`/materiales/${material.id}/editar`)}
              >
                ✎ Editar material
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
