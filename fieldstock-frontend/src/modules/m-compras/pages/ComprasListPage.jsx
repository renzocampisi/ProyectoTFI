// src/modules/m-compras/pages/ComprasListPage.jsx
/**
 * Listado de órdenes de compra a proveedores.
 *
 * PARTE 1/6 del módulo Compras — read-only por ahora. La creación está
 * en la parte 2 (botón "+ Nueva compra" funciona pero todavía no hay form).
 * Los filtros por estado y proveedor llegan en la parte 6.
 *
 * Inspirado en RemitosListPage para mantener consistencia visual.
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompras } from '../hooks/useCompras'
import { ProveedoresService } from '@modules/m7-directorio/services/directorio.service'
import EstadoBadge from '../components/EstadoBadge'
import { ESTADO_INFO, MEDIO_PAGO_LABEL, formatFecha, formatMoney } from '../constants'
import styles from './ComprasListPage.module.css'

// Orden de los chips de filtro. TODOS primero, después los estados activos
// arriba (más comunes) y los terminales al final.
const ESTADOS_FILTRO = [
  'TODOS',
  'BORRADOR',
  'CONFIRMADA',
  'RECIBIDA_PARCIAL',
  'RECIBIDA',
  'CANCELADA',
]

export default function ComprasListPage() {
  const navigate = useNavigate()

  // ── Estado de filtros ──────────────────────────────────────────
  const [filtroEstado,    setFiltroEstado]    = useState('TODOS')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [proveedores,     setProveedores]     = useState([])

  // Para los chips de count traemos TODAS las compras sin filtro y
  // los counts los calculamos client-side (mismo patrón que
  // RemitosListPage). Evita un endpoint extra para los conteos.
  const { compras: todasLasCompras, loading: loadingAll, error: errorAll } = useCompras({
    proveedorId: filtroProveedor || undefined,
  })

  // La lista visible se filtra por estado en cliente (los datos ya están
  // cargados). El backend igual soporta el filtro de estado, pero acá
  // priorizamos no hacer round-trip cada vez que cambias de chip.
  const compras = useMemo(() => {
    if (filtroEstado === 'TODOS') return todasLasCompras
    return todasLasCompras.filter(c => c.estado === filtroEstado)
  }, [todasLasCompras, filtroEstado])

  // Counts por estado, calculados del set completo (no del filtrado).
  const conteos = useMemo(() => {
    const acc = { TODOS: todasLasCompras.length }
    for (const c of todasLasCompras) {
      acc[c.estado] = (acc[c.estado] || 0) + 1
    }
    return acc
  }, [todasLasCompras])

  // Cargar proveedores una vez para el select del filtro.
  useEffect(() => {
    let cancelado = false
    ProveedoresService.getAll()
      .then(data => { if (!cancelado) setProveedores(Array.isArray(data) ? data : []) })
      .catch(() => {}) // Sin proveedores el select queda vacío, no es bloqueante.
    return () => { cancelado = true }
  }, [])

  const loading = loadingAll
  const error   = errorAll

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Compras</h1>
          <p className={styles.subtitle}>
            {loading
              ? 'Cargando...'
              : `${compras.length} orden${compras.length !== 1 ? 'es' : ''} de compra${filtroEstado !== 'TODOS' || filtroProveedor ? ' (filtradas)' : ''}`}
          </p>
        </div>
        {/* Botón apunta a la ruta del form, que se implementa en la parte 2.
            Por ahora si la clickeás te lleva a una ruta inexistente. */}
        <button className={styles.btnPrimary} onClick={() => navigate('/compras/nuevo')}>
          + Nueva compra
        </button>
      </div>

      {/* ── Chips de filtro por estado ─────────────────────────── */}
      <div className={styles.estadoChips}>
        {ESTADOS_FILTRO.map(estado => {
          const label = estado === 'TODOS' ? 'Todas' : ESTADO_INFO[estado]?.label || estado
          const count = conteos[estado] ?? 0
          const active = filtroEstado === estado
          return (
            <button key={estado}
              type="button"
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              onClick={() => setFiltroEstado(estado)}>
              {label}
              <span className={styles.chipCount}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar: select de proveedor ───────────────────────── */}
      <div className={styles.toolbar}>
        <select className={styles.selectProveedor}
          value={filtroProveedor}
          onChange={e => setFiltroProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => (
            <option key={p.id} value={p.id}>{p.nombre || 'Sin nombre'}</option>
          ))}
        </select>
        {(filtroEstado !== 'TODOS' || filtroProveedor) && (
          <button type="button" className={styles.btnLimpiar}
            onClick={() => { setFiltroEstado('TODOS'); setFiltroProveedor('') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          <span className={styles.spinner} /> Cargando compras...
        </div>
      )}

      {!loading && !error && compras.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🛒</span>
          <p>Todavía no hay órdenes de compra.</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/compras/nuevo')}>
            Crear primera compra
          </button>
        </div>
      )}

      {!loading && !error && compras.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Fecha pedido</th>
                <th>Items</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Medio de pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {compras.map(c => (
                <tr key={c.id} className={styles.row}
                  onClick={() => navigate(`/compras/${c.id}`)}>
                  <td className={styles.numero} data-label="Número">{c.numero}</td>
                  <td className={styles.proveedor} data-label="Proveedor">
                    {c.proveedor_nombre || c.proveedor?.nombre || '—'}
                  </td>
                  <td className={styles.fecha} data-label="Fecha pedido">
                    {formatFecha(c.fecha_pedido)}
                  </td>
                  <td className={styles.cant} data-label="Items">
                    {c.cantidad_items ?? c.items?.length ?? 0}
                  </td>
                  <td className={styles.estadoCell} data-label="Estado">
                    <EstadoBadge estado={c.estado} />
                  </td>
                  <td className={styles.total} data-label="Total">
                    {formatMoney(c.total)}
                  </td>
                  <td className={styles.medio} data-label="Medio de pago">
                    {MEDIO_PAGO_LABEL[c.medio_pago] || c.medio_pago}
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); navigate(`/compras/${c.id}`) }}>
                      Ver →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
