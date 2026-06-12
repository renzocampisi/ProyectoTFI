// src/modules/m-compras/pages/ComprasDetailPage.jsx
/**
 * Vista de detalle de una orden de compra. Read-only en esta parte —
 * los botones de acción (confirmar, recibir, cancelar) llegan en partes
 * 4 y 5. La edición de items en BORRADOR llega en parte 6.
 *
 * Layout inspirado en RemitosDetailPage para consistencia visual:
 *   - Header: número OC-XXXXX grande + badge de estado
 *   - Card "Datos generales": proveedor, fechas, medio de pago, observaciones
 *   - Tabla de items con material, cantidad, precio, subtotal,
 *     cantidad_recibida (solo si > 0 — destaca lo que falta)
 *   - Total bien grande al pie
 *
 * Tolera URLs inventadas: si la compra no existe, mensaje amable + link
 * para volver al listado.
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useCompra } from '../hooks/useCompras'
import EstadoBadge from '../components/EstadoBadge'
import {
  MEDIO_PAGO_LABEL, formatFecha, formatFechaHora, formatMoney, formatCantidad,
} from '../constants'
import styles from './ComprasDetailPage.module.css'

function Campo({ label, value }) {
  return (
    <div className={styles.campo}>
      <span className={styles.campoLabel}>{label}</span>
      <span className={styles.campoValue}>{value || '—'}</span>
    </div>
  )
}

export default function ComprasDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { compra, loading, error } = useCompra(id)

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <span className={styles.spinner} /> Cargando compra...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <button className={styles.btnGhost} onClick={() => navigate('/compras')}>← Volver al listado</button>
        <div className={styles.errorBanner}>⚠ {error}</div>
      </div>
    )
  }

  if (!compra) {
    return (
      <div className={styles.page}>
        <button className={styles.btnGhost} onClick={() => navigate('/compras')}>← Volver al listado</button>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🤔</span>
          <p>No encontramos la compra que buscás.</p>
          <p className={styles.emptyHint}>Puede que la URL esté mal o que se haya eliminado.</p>
        </div>
      </div>
    )
  }

  // ── Cabecera ────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <button className={styles.btnGhost} onClick={() => navigate('/compras')}>← Volver al listado</button>

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.numero}>{compra.numero}</div>
          <div className={styles.subInfo}>
            <EstadoBadge estado={compra.estado} />
            <span className={styles.subDot}>·</span>
            <span className={styles.subText}>
              Pedida el {formatFecha(compra.fecha_pedido) === '—' ? 'todavía no confirmada' : formatFecha(compra.fecha_pedido)}
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalValue}>{formatMoney(compra.total)}</span>
        </div>
      </header>

      {/* ── Datos generales ──────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Datos generales</h2>
        <div className={styles.camposGrid}>
          <Campo label="Proveedor"        value={compra.proveedor_nombre || compra.proveedor?.nombre} />
          <Campo label="CUIT proveedor"   value={compra.proveedor?.cuit} />
          <Campo label="Teléfono"         value={compra.proveedor?.telefono} />
          <Campo label="Email"            value={compra.proveedor?.email} />
          <Campo label="Medio de pago"    value={MEDIO_PAGO_LABEL[compra.medio_pago] || compra.medio_pago} />
          <Campo label="Fecha creación"   value={formatFechaHora(compra.created_at)} />
          <Campo label="Fecha pedido"     value={formatFechaHora(compra.fecha_pedido)} />
          <Campo label="Fecha recepción"  value={formatFechaHora(compra.fecha_recepcion)} />
        </div>
        {compra.observaciones && (
          <div className={styles.observaciones}>
            <span className={styles.campoLabel}>Observaciones</span>
            <p className={styles.observacionesText}>{compra.observaciones}</p>
          </div>
        )}
      </section>

      {/* ── Items ────────────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Items ({compra.items?.length || 0})</h2>

        {!compra.items || compra.items.length === 0 ? (
          <div className={styles.itemsEmpty}>Esta compra no tiene items.</div>
        ) : (
          <div className={styles.itemsTableWrapper}>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Cantidad</th>
                  <th>Precio unit.</th>
                  <th>Subtotal</th>
                  {/* Columna "Recibido" solo si hay al menos un item con
                      cantidad_recibida > 0. Evita ruido visual cuando la
                      compra aún no se recibió. */}
                  {compra.items.some(it => Number(it.cantidad_recibida) > 0) && (
                    <th>Recibido</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {compra.items.map(it => {
                  const recibido = Number(it.cantidad_recibida) || 0
                  const pedido   = Number(it.cantidad) || 0
                  const completo = recibido >= pedido
                  return (
                    <tr key={it.id} className={styles.itemRow}>
                      <td className={styles.cellMaterial} data-label="Material">
                        <div className={styles.materialNombre}>{it.material_nombre || it.material?.nombre || '—'}</div>
                        {it.material_unidad && (
                          <div className={styles.materialMeta}>Unidad: {it.material_unidad}</div>
                        )}
                      </td>
                      <td className={styles.cellNum} data-label="Cantidad">
                        {formatCantidad(pedido)}
                      </td>
                      <td className={styles.cellNum} data-label="Precio unit.">
                        {formatMoney(it.precio_unitario)}
                      </td>
                      <td className={styles.cellSubtotal} data-label="Subtotal">
                        {formatMoney(it.subtotal)}
                      </td>
                      {compra.items.some(x => Number(x.cantidad_recibida) > 0) && (
                        <td className={styles.cellRecibido} data-label="Recibido">
                          <span className={completo ? styles.recibidoCompleto : styles.recibidoParcial}>
                            {formatCantidad(recibido)} / {formatCantidad(pedido)}
                          </span>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className={styles.totalRowLabel}>Total</td>
                  <td className={styles.totalRowValue}>{formatMoney(compra.total)}</td>
                  {compra.items.some(it => Number(it.cantidad_recibida) > 0) && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Espacio reservado para los botones de acción (partes 4 y 5).
          Por ahora no se renderiza nada — la UI queda explícitamente
          read-only en esta entrega. */}

    </div>
  )
}
