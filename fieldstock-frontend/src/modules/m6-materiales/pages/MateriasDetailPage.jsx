// src/modules/m6-materiales/pages/MateriasDetailPage.jsx
/**
 * Página de detalle de un material (issue #51 parte 1).
 *
 * Hasta ahora el detalle vivía solo como modal sobre la lista
 * (MaterialDetalleModal, Word #19). Esto agrega una ruta dedicada
 * /materiales/:id para:
 *   - Habilitar deep-links ("mirá este material").
 *   - Servir de destino para futuras notifs STOCK_BAJO (issue #51 parte 2).
 *   - Mostrar más info que el modal sin tener que apretar tamaño.
 *
 * El modal sigue siendo útil como preview rápido — desde ahí ahora hay
 * un botón "Ver detalle completo →" que lleva acá.
 *
 * Layout consistente con ComprasDetailPage y RemitosDetailPage:
 *   - Header con nombre + badge de stock
 *   - Card de datos generales (grid de campos)
 *   - Card de acciones (editar, eliminar)
 *
 * Tolera URLs inventadas: si el material no existe, mensaje amable + link
 * para volver al listado.
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MaterialesService } from '../services/materiales.service'
import MarcaLogo from '@shared/components/MarcaLogo'
import AgregarStockModal from '../components/AgregarStockModal'
import styles from './MateriasDetailPage.module.css'

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
  const a = Number(actual), m = Number(minimo)
  if (a === 0)              return { label: 'Agotado',    cls: styles.estadoAgotado }
  if (m > 0 && a <= m)      return { label: 'Stock bajo', cls: styles.estadoBajo }
  return { label: 'OK', cls: styles.estadoOk }
}

function Campo({ label, value, mono = false }) {
  return (
    <div className={styles.campo}>
      <span className={styles.campoLabel}>{label}</span>
      <span className={`${styles.campoValue} ${mono ? styles.mono : ''}`}>
        {value === null || value === undefined || value === ''
          ? <span className={styles.empty}>—</span>
          : value}
      </span>
    </div>
  )
}

export default function MateriasDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // No usamos un hook compartido porque hoy el módulo no tiene useMaterial(id)
  // — la lista usa useMateriales() agregado. Si en el futuro hace falta polling,
  // se sube a hooks/useMaterial.js. Por ahora, fetch inline.
  const [material, setMaterial] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  // Estado de acciones (eliminar, agregar stock)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eliminando,    setEliminando]    = useState(false)
  const [errAccion,     setErrAccion]     = useState(null)
  const [showStock,     setShowStock]     = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await MaterialesService.getById(id)
      setMaterial(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const handleEliminar = async () => {
    if (eliminando) return
    setEliminando(true); setErrAccion(null)
    try {
      await MaterialesService.remove(material.id)
      // Tras eliminar, volvemos al listado — el material ya no figura ahí
      // y quedarse en la página de un material desactivado no aporta nada.
      navigate('/materiales')
    } catch (err) {
      setErrAccion(err.message || 'No se pudo eliminar el material.')
      setEliminando(false)
    }
  }

  // ── Estados de error / loading / no encontrado ────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <span className={styles.spinner} /> Cargando material...
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className={styles.page}>
        <button className={styles.btnGhost} onClick={() => navigate('/materiales')}>← Volver al listado</button>
        <div className={styles.errorBanner}>⚠ {error}</div>
      </div>
    )
  }
  if (!material) {
    return (
      <div className={styles.page}>
        <button className={styles.btnGhost} onClick={() => navigate('/materiales')}>← Volver al listado</button>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🤔</span>
          <p>No encontramos este material.</p>
          <p className={styles.emptyHint}>Puede que la URL esté mal o que se haya eliminado del catálogo.</p>
        </div>
      </div>
    )
  }

  const estado = estadoStockLabel(material.stock_actual, material.stock_minimo)

  return (
    <div className={styles.page}>

      <button className={styles.btnGhost} onClick={() => navigate('/materiales')}>← Volver al listado</button>

      {/* ── Header con nombre + estado de stock ──────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
          <MarcaLogo marca={material.marca} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className={styles.nombre}>{material.nombre}</h1>
            <div className={styles.subInfo}>
              <span className={`${styles.estadoBadge} ${estado.cls}`}>{estado.label}</span>
              {material.marca && (
                <>
                  <span className={styles.subDot}>·</span>
                  <span className={styles.subText}>{material.marca}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.totalLabel}>Stock actual</span>
          <span className={styles.totalValue}>
            {material.stock_actual} <span className={styles.totalUnidad}>{material.unidad}</span>
          </span>
        </div>
      </header>

      {/* ── Card datos generales ────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Datos generales</h2>
        <div className={styles.camposGrid}>
          <Campo label="Marca"          value={material.marca} />
          <Campo label="Unidad"         value={material.unidad} />
          <Campo label="Stock mínimo"   value={`${material.stock_minimo} ${material.unidad || ''}`.trim()} />
          <Campo label="ID interno"     value={material.id} mono />
          <Campo label="Creado"         value={formatDateTime(material.created_at)} mono />
          <Campo label="Última actualización" value={formatDateTime(material.updated_at)} mono />
        </div>

        {material.descripcion && (
          <div className={styles.observaciones}>
            <span className={styles.campoLabel}>Descripción</span>
            <p className={styles.observacionesText}>{material.descripcion}</p>
          </div>
        )}
      </section>

      {/* ── Card acciones ───────────────────────────────────── */}
      <section className={styles.acciones}>
        {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}

        {!confirmDelete ? (
          <div className={styles.accionesBotones}>
            <button type="button" className={styles.btnCancelar}
              onClick={() => { setErrAccion(null); setConfirmDelete(true) }}>
              🗑 Eliminar
            </button>
            <button type="button" className={styles.btnGhost}
              onClick={() => setShowStock(true)}>
              + Agregar stock
            </button>
            <button type="button" className={styles.btnConfirmar}
              onClick={() => navigate(`/materiales/${material.id}/editar`)}>
              ✎ Editar
            </button>
          </div>
        ) : (
          <div className={styles.confirmBlock}>
            <p className={styles.confirmText}>
              ¿Eliminar <strong>{material.nombre}</strong> del catálogo? Sale del
              listado pero queda en remitos viejos para no romper la auditoría.
              Si está en uso en remitos abiertos, el backend va a bloquear la
              operación.
            </p>
            <div className={styles.accionesBotones}>
              <button type="button" className={styles.btnGhost}
                onClick={() => { setConfirmDelete(false); setErrAccion(null) }}
                disabled={eliminando}>
                Cancelar
              </button>
              <button type="button" className={styles.btnCancelarConfirm}
                onClick={handleEliminar} disabled={eliminando}>
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modal de agregar stock — flujo Word A. Reutilizado del listado. */}
      {showStock && (
        <AgregarStockModal
          material={material}
          onClose={() => setShowStock(false)}
          onSuccess={() => { setShowStock(false); cargar() }}
        />
      )}

    </div>
  )
}
