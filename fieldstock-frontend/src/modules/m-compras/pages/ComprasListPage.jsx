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
import styles from './ComprasListPage.module.css'

// Colores y labels de cada estado. Naranja para "parcial" (atención), verde
// para terminado OK, rojo para terminal negativo, azul para activo, gris
// para borrador. Coherente con la paleta del sistema.
const ESTADO_INFO = {
  BORRADOR:          { label: 'Borrador',          cls: styles.estadoBorrador },
  CONFIRMADA:        { label: 'Confirmada',        cls: styles.estadoConfirmada },
  RECIBIDA_PARCIAL:  { label: 'Recibida parcial',  cls: styles.estadoParcial },
  RECIBIDA:          { label: 'Recibida',          cls: styles.estadoRecibida },
  CANCELADA:         { label: 'Cancelada',         cls: styles.estadoCancelada },
}

const MEDIO_PAGO_LABEL = {
  EFECTIVO:         'Efectivo',
  TRANSFERENCIA:    'Transferencia',
  CHEQUE:           'Cheque',
  TARJETA:          'Tarjeta',
  CUENTA_CORRIENTE: 'Cuenta corriente',
}

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatMoney(n) {
  if (n == null) return '—'
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
}

function EstadoBadge({ estado }) {
  const info = ESTADO_INFO[estado] || { label: estado, cls: '' }
  return <span className={`${styles.estadoBadge} ${info.cls}`}>{info.label}</span>
}

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
                    {c.proveedor?.razon_social || c.proveedor_nombre || '—'}
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
