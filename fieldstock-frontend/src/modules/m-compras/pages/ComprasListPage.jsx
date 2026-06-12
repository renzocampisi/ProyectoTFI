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
import { useNavigate } from 'react-router-dom'
import { useCompras } from '../hooks/useCompras'
import EstadoBadge from '../components/EstadoBadge'
import { MEDIO_PAGO_LABEL, formatFecha, formatMoney } from '../constants'
import styles from './ComprasListPage.module.css'

export default function ComprasListPage() {
  const navigate = useNavigate()
  const { compras, loading, error } = useCompras()

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Compras</h1>
          <p className={styles.subtitle}>
            {loading
              ? 'Cargando...'
              : `${compras.length} orden${compras.length !== 1 ? 'es' : ''} de compra`}
          </p>
        </div>
        {/* Botón apunta a la ruta del form, que se implementa en la parte 2.
            Por ahora si la clickeás te lleva a una ruta inexistente. */}
        <button className={styles.btnPrimary} onClick={() => navigate('/compras/nuevo')}>
          + Nueva compra
        </button>
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
