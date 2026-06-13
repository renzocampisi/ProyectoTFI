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
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCompra } from '../hooks/useCompras'
import { ComprasService } from '../services/compras.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import EstadoBadge from '../components/EstadoBadge'
import RecepcionModal from '../components/RecepcionModal'
import {
  MEDIO_PAGO_LABEL, formatFecha, formatFechaHora, formatMoney, formatCantidad,
} from '../constants'
import styles from './ComprasDetailPage.module.css'

// Mapping estado → qué botones se renderizan en la card de acciones.
// Centralizado para ver de un vistazo qué transiciones hay disponibles.
const ACCIONES_POR_ESTADO = {
  BORRADOR:         { confirmar: true,  cancelar: true,  recibir: false },
  CONFIRMADA:       { confirmar: false, cancelar: true,  recibir: true  },
  RECIBIDA_PARCIAL: { confirmar: false, cancelar: false, recibir: true  },
  RECIBIDA:         { confirmar: false, cancelar: false, recibir: false },
  CANCELADA:        { confirmar: false, cancelar: false, recibir: false },
}

function Campo({ label, value }) {
  return (
    <div className={styles.campo}>
      <span className={styles.campoLabel}>{label}</span>
      <span className={styles.campoValue}>{value || '—'}</span>
    </div>
  )
}

/**
 * Form inline para agregar un item nuevo a una compra BORRADOR.
 * Se monta al pie de la sección de items cuando el usuario clickea
 * "+ Agregar item". Al confirmar dispara onSubmit con el body listo
 * para el backend; al cancelar dispara onCancel sin tocar nada.
 *
 * Es local porque la lógica está acoplada al detail (qué materiales
 * mostrar, qué hacer al success). Si en algún momento se reutiliza
 * en otro lado, se promueve a components/.
 */
function AddItemForm({ materiales, onSubmit, onCancel }) {
  const [materialId, setMaterialId] = useState('')
  const [cantidad,   setCantidad]   = useState('')
  const [precio,     setPrecio]     = useState('')
  const [guardando,  setGuardando]  = useState(false)
  const [err,        setErr]        = useState(null)

  const handle = async (e) => {
    e.preventDefault()
    if (guardando) return
    const cant = Number(cantidad), prec = Number(precio)
    if (!materialId) return setErr('Elegí un material.')
    if (!Number.isFinite(cant) || cant <= 0) return setErr('La cantidad debe ser mayor a 0.')
    if (!Number.isFinite(prec) || prec < 0) return setErr('El precio no puede ser negativo.')

    setGuardando(true); setErr(null)
    try {
      await onSubmit({
        materialId:     materialId,
        cantidad:       cant,
        precioUnitario: prec,
      })
    } catch (e) {
      // El padre ya guardó el error en errItems del detail, pero también
      // mostramos uno local para que el usuario lo vea sin perder contexto.
      setErr(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className={styles.addItemForm} onSubmit={handle}>
      <div className={styles.addItemHeader}>
        <strong>Agregar item</strong>
      </div>
      <div className={styles.addItemFields}>
        <div className={styles.addItemField}>
          <label className={styles.campoLabel}>Material</label>
          <select className={styles.inputNumInline}
            value={materialId} onChange={e => setMaterialId(e.target.value)}>
            <option value="">— Elegí material —</option>
            {materiales.map(m => (
              <option key={m.id} value={m.id}>
                {m.nombre}{m.marca ? ` (${m.marca})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.addItemField}>
          <label className={styles.campoLabel}>Cantidad</label>
          <input type="number" min="0.01" step="any"
            className={styles.inputNumInline}
            placeholder="0"
            value={cantidad} onChange={e => setCantidad(e.target.value)} />
        </div>
        <div className={styles.addItemField}>
          <label className={styles.campoLabel}>Precio unit.</label>
          <input type="number" min="0" step="0.01"
            className={styles.inputNumInline}
            placeholder="0,00"
            value={precio} onChange={e => setPrecio(e.target.value)} />
        </div>
      </div>
      {err && <div className={styles.errorBanner}>⚠ {err}</div>}
      <div className={styles.addItemActions}>
        <button type="button" className={styles.btnGhost}
          onClick={onCancel} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className={styles.btnConfirmar}
          disabled={guardando}>
          {guardando ? 'Agregando...' : 'Agregar'}
        </button>
      </div>
    </form>
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
  const [showRecepcion,   setShowRecepcion]   = useState(false)

  // ── Edición de items (solo BORRADOR) ────────────────────────
  // Form mini de "Agregar item" se muestra/oculta inline al pie de la tabla.
  const [showAddItem, setShowAddItem] = useState(false)
  const [errItems,    setErrItems]    = useState(null)
  const [removingId,  setRemovingId]  = useState(null)

  // Materiales se cargan una vez al detectar estado BORRADOR — sirven
  // tanto para el form de agregar item como para mostrar el nombre del
  // material en cada fila (el backend ya devuelve material_nombre, pero
  // si el material fue eliminado podríamos necesitar el fallback).
  const [materiales, setMateriales] = useState([])
  useEffect(() => {
    if (compra?.estado !== 'BORRADOR') return
    let cancelado = false
    MaterialesService.getAll()
      .then(d => { if (!cancelado) setMateriales(Array.isArray(d) ? d : []) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [compra?.estado])

  // Debounce de PATCH por item: cada item tiene su propio timeout.
  // Si el usuario tipea rápido en cantidad o precio, solo dispara
  // la última versión del valor 500ms después de parar.
  const debounceMapRef = useRef(new Map())
  const debouncedUpdate = (itemId, body) => {
    const map = debounceMapRef.current
    if (map.has(itemId)) clearTimeout(map.get(itemId))
    map.set(itemId, setTimeout(async () => {
      try {
        await ComprasService.updateItem(compra.id, itemId, body)
        await refetch()
        setErrItems(null)
      } catch (err) { setErrItems(err.message) }
    }, 500))
  }

  // State local del valor "en el aire" mientras el debounce no disparó.
  // Sin esto, cada keystroke causaría un render con el valor viejo del
  // backend hasta que termine el PATCH + refetch.
  const [localOverrides, setLocalOverrides] = useState({}) // { itemId: { cantidad?, precio_unitario? } }
  const setLocal = (itemId, campo, valor) => {
    setLocalOverrides(prev => ({ ...prev, [itemId]: { ...prev[itemId], [campo]: valor } }))
  }

  const handleEditCantidad = (itemId, valor) => {
    setLocal(itemId, 'cantidad', valor)
    const num = Number(valor)
    if (!Number.isFinite(num) || num <= 0) return // sin disparar PATCH con valor inválido
    debouncedUpdate(itemId, { cantidad: num })
  }
  const handleEditPrecio = (itemId, valor) => {
    setLocal(itemId, 'precio_unitario', valor)
    const num = Number(valor)
    if (!Number.isFinite(num) || num < 0) return
    debouncedUpdate(itemId, { precioUnitario: num })
  }

  const handleRemoveItem = async (item) => {
    if (removingId) return
    const nombre = item.material_nombre || item.material?.nombre || 'este item'
    if (!window.confirm(`¿Eliminar "${nombre}" de la compra?`)) return
    setRemovingId(item.id); setErrItems(null)
    try {
      await ComprasService.removeItem(compra.id, item.id)
      await refetch()
    } catch (err) { setErrItems(err.message) }
    finally { setRemovingId(null) }
  }

  // El form de agregar item es local — se desmonta al cerrar para resetear.
  // Limpia las overrides locales del estado de la compra al cambiar la
  // identidad o cuando dejamos BORRADOR (no tiene sentido conservarlas).
  useEffect(() => {
    if (compra?.estado !== 'BORRADOR') setLocalOverrides({})
  }, [compra?.id, compra?.estado])

  // Tras una recepción exitosa: cerrar modal + refetch para reflejar
  // nuevos cantidad_recibida + posible cambio de estado a
  // RECIBIDA_PARCIAL o RECIBIDA. La columna "Recibido" del detail
  // aparece sola por el toggle condicional.
  const handleRecepcionSuccess = async () => {
    setShowRecepcion(false)
    await refetch()
  }

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
        <div className={styles.itemsHeader}>
          <h2 className={styles.cardTitle}>Items ({compra.items?.length || 0})</h2>
          {compra.estado === 'BORRADOR' && !showAddItem && (
            <button type="button" className={styles.btnLink}
              onClick={() => setShowAddItem(true)}>
              + Agregar item
            </button>
          )}
        </div>

        {errItems && <div className={styles.errorBanner}>⚠ {errItems}</div>}

        {/* Solo BORRADOR muestra la tabla editable. En cualquier otro
            estado la tabla es read-only (igual que antes). */}
        {(!compra.items || compra.items.length === 0) && !showAddItem ? (
          <div className={styles.itemsEmpty}>
            Esta compra no tiene items.
            {compra.estado === 'BORRADOR' && ' Agregá al menos uno antes de confirmarla.'}
          </div>
        ) : (
          <div className={styles.itemsTableWrapper}>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Cantidad</th>
                  <th>Precio unit.</th>
                  <th>Subtotal</th>
                  {compra.items.some(it => Number(it.cantidad_recibida) > 0) && (
                    <th>Recibido</th>
                  )}
                  {compra.estado === 'BORRADOR' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {compra.items.map(it => {
                  const recibido = Number(it.cantidad_recibida) || 0
                  const pedido   = Number(it.cantidad) || 0
                  const completo = recibido >= pedido
                  const editable = compra.estado === 'BORRADOR'
                  // Para los inputs editables: usamos el override local si
                  // existe (todavía no se sincronizó con backend), sino el
                  // valor real de la compra.
                  const overrides = localOverrides[it.id] || {}
                  const valCantidad = overrides.cantidad !== undefined ? overrides.cantidad : it.cantidad
                  const valPrecio   = overrides.precio_unitario !== undefined ? overrides.precio_unitario : it.precio_unitario
                  return (
                    <tr key={it.id} className={styles.itemRow}>
                      <td className={styles.cellMaterial} data-label="Material">
                        <div className={styles.materialNombre}>{it.material_nombre || it.material?.nombre || '—'}</div>
                        {it.material_unidad && (
                          <div className={styles.materialMeta}>Unidad: {it.material_unidad}</div>
                        )}
                      </td>
                      <td className={styles.cellNum} data-label="Cantidad">
                        {editable ? (
                          <input type="number" min="0.01" step="any"
                            className={styles.inputNumInline}
                            value={valCantidad}
                            onChange={e => handleEditCantidad(it.id, e.target.value)} />
                        ) : (
                          formatCantidad(pedido)
                        )}
                      </td>
                      <td className={styles.cellNum} data-label="Precio unit.">
                        {editable ? (
                          <input type="number" min="0" step="0.01"
                            className={styles.inputNumInline}
                            value={valPrecio}
                            onChange={e => handleEditPrecio(it.id, e.target.value)} />
                        ) : (
                          formatMoney(it.precio_unitario)
                        )}
                      </td>
                      <td className={styles.cellSubtotal} data-label="Subtotal">
                        {/* Si está editable y el override local difiere, calculamos
                            el subtotal en vivo para feedback inmediato (no esperar
                            al refetch del backend). */}
                        {editable && (overrides.cantidad !== undefined || overrides.precio_unitario !== undefined)
                          ? formatMoney(Number(valCantidad || 0) * Number(valPrecio || 0))
                          : formatMoney(it.subtotal)}
                      </td>
                      {compra.items.some(x => Number(x.cantidad_recibida) > 0) && (
                        <td className={styles.cellRecibido} data-label="Recibido">
                          <span className={completo ? styles.recibidoCompleto : styles.recibidoParcial}>
                            {formatCantidad(recibido)} / {formatCantidad(pedido)}
                          </span>
                        </td>
                      )}
                      {editable && (
                        <td className={styles.cellActions}>
                          <button type="button" className={styles.btnRemoveItem}
                            onClick={() => handleRemoveItem(it)}
                            disabled={removingId === it.id || compra.items.length === 1}
                            title={compra.items.length === 1 ? 'No se puede dejar la compra sin items' : 'Eliminar item'}>
                            {removingId === it.id ? '...' : '🗑'}
                          </button>
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
                  {compra.estado === 'BORRADOR' && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Form mini de "Agregar item" — inline al pie de la sección. */}
        {compra.estado === 'BORRADOR' && showAddItem && (
          <AddItemForm
            materiales={materiales}
            onCancel={() => setShowAddItem(false)}
            onSubmit={async (body) => {
              setErrItems(null)
              try {
                await ComprasService.addItem(compra.id, body)
                await refetch()
                setShowAddItem(false)
              } catch (err) { setErrItems(err.message); throw err }
            }} />
        )}
      </section>

      {/* ── Card de acciones ─────────────────────────────────
          Renderizada solo si el estado actual habilita al menos una
          acción. RECIBIDA y CANCELADA son terminales — no aparece nada.
          Recibir va en parte 5. */}
      {(() => {
        const acciones = ACCIONES_POR_ESTADO[compra.estado] || {}
        const hayAlguna = acciones.confirmar || acciones.cancelar || acciones.recibir
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
              {acciones.recibir && (
                <button type="button" className={styles.btnConfirmar}
                  onClick={() => { setErrAccion(null); setShowRecepcion(true) }}
                  disabled={accionando}>
                  Registrar recepción
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

      {/* ── Modal de recepción ───────────────────────────────
          Componente aparte porque la UX es más compleja: lista de inputs
          por item, atajos (todo / nada), validación, conversión delta →
          total absoluto antes de mandar al backend. */}
      {showRecepcion && (
        <RecepcionModal
          compra={compra}
          onClose={() => setShowRecepcion(false)}
          onSuccess={handleRecepcionSuccess} />
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
