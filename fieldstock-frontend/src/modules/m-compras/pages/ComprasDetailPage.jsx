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
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompra } from '../hooks/useCompras'
import { ComprasService } from '../services/compras.service'
import EstadoBadge from '../components/EstadoBadge'
import {
  MEDIO_PAGO_LABEL, formatFecha, formatFechaHora, formatMoney, formatCantidad,
} from '../constants'
import styles from './ComprasDetailPage.module.css'

// Mapping estado → qué botones se renderizan en la card de acciones.
// Centralizado para ver de un vistazo qué transiciones hay disponibles.
const ACCIONES_POR_ESTADO = {
  BORRADOR:         { confirmar: true,  cancelar: true  },
  CONFIRMADA:       { confirmar: false, cancelar: true  },
  RECIBIDA_PARCIAL: { confirmar: false, cancelar: false }, // recibir va en parte 5
  RECIBIDA:         { confirmar: false, cancelar: false },
  CANCELADA:        { confirmar: false, cancelar: false },
}

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
  const { compra, loading, error, refetch } = useCompra(id)

  // ── Estado de las acciones (confirmar / cancelar) ──────────────
  // Los dos modales son excluyentes pero usamos estados separados para
  // claridad. `accionando` bloquea ambos botones mientras una request
  // está en vuelo (evita doble click).
  const [confirmAvanzar,  setConfirmAvanzar]  = useState(false)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [motivoCancel,    setMotivoCancel]    = useState('')
  const [accionando,      setAccionando]      = useState(false)
  const [errAccion,       setErrAccion]       = useState(null)

  const handleAvanzar = async () => {
    if (accionando) return
    setAccionando(true); setErrAccion(null)
    try {
      await ComprasService.avanzar(id)
      setConfirmAvanzar(false)
      await refetch()
    } catch (err) { setErrAccion(err.message) }
    finally { setAccionando(false) }
  }

  const handleCancelar = async () => {
    if (accionando) return
    setAccionando(true); setErrAccion(null)
    try {
      await ComprasService.cancelar(id, motivoCancel.trim() || undefined)
      setConfirmCancelar(false)
      setMotivoCancel('')
      await refetch()
    } catch (err) { setErrAccion(err.message) }
    finally { setAccionando(false) }
  }

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

      {/* ── Card de acciones ─────────────────────────────────
          Renderizada solo si el estado actual habilita al menos una
          acción. RECIBIDA y CANCELADA son terminales — no aparece nada.
          Recibir va en parte 5. */}
      {(() => {
        const acciones = ACCIONES_POR_ESTADO[compra.estado] || {}
        const hayAlguna = acciones.confirmar || acciones.cancelar
        if (!hayAlguna) return null
        return (
          <section className={styles.acciones}>
            {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}
            <div className={styles.accionesBotones}>
              {acciones.cancelar && (
                <button type="button" className={styles.btnCancelar}
                  onClick={() => { setErrAccion(null); setConfirmCancelar(true) }}
                  disabled={accionando}>
                  Cancelar compra
                </button>
              )}
              {acciones.confirmar && (
                <button type="button" className={styles.btnConfirmar}
                  onClick={() => { setErrAccion(null); setConfirmAvanzar(true) }}
                  disabled={accionando}>
                  Confirmar pedido
                </button>
              )}
            </div>
          </section>
        )
      })()}

      {/* ── Modal confirmar avance ──────────────────────────── */}
      {confirmAvanzar && (
        <div className={styles.modalOverlay}
          onClick={() => !accionando && setConfirmAvanzar(false)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Confirmar el pedido?</h3>
            <p className={styles.modalText}>
              Vas a marcar <strong>{compra.numero}</strong> como pedida al proveedor.
              Después de confirmar <strong>no vas a poder editar los items</strong> ni
              cambiar el proveedor.
            </p>
            {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost}
                onClick={() => setConfirmAvanzar(false)}
                disabled={accionando}>
                Volver
              </button>
              <button type="button" className={styles.btnConfirmar}
                onClick={handleAvanzar}
                disabled={accionando}>
                {accionando ? 'Confirmando...' : 'Sí, confirmar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cancelar ──────────────────────────────────── */}
      {confirmCancelar && (
        <div className={styles.modalOverlay}
          onClick={() => !accionando && setConfirmCancelar(false)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Cancelar la compra?</h3>
            <p className={styles.modalText}>
              Vas a cancelar <strong>{compra.numero}</strong>. La compra queda
              registrada en estado CANCELADA y no se puede deshacer.
            </p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="motivoCancel">
                Motivo (opcional)
              </label>
              <textarea id="motivoCancel" className={styles.modalTextarea}
                rows={2}
                placeholder="Ej: el proveedor no tiene stock, error de carga, etc."
                value={motivoCancel}
                onChange={e => setMotivoCancel(e.target.value)}
                disabled={accionando} />
            </div>
            {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost}
                onClick={() => { setConfirmCancelar(false); setMotivoCancel('') }}
                disabled={accionando}>
                Volver
              </button>
              <button type="button" className={styles.btnCancelarConfirm}
                onClick={handleCancelar}
                disabled={accionando}>
                {accionando ? 'Cancelando...' : 'Sí, cancelar compra'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
