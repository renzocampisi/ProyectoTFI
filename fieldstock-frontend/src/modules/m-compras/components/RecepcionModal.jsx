// src/modules/m-compras/components/RecepcionModal.jsx
/**
 * Modal para registrar la recepción de los items de una compra
 * CONFIRMADA o RECIBIDA_PARCIAL.
 *
 * UX:
 *  - El usuario piensa en "lo que físicamente está llegando AHORA"
 *    (delta), no en "el total acumulado recibido". Por eso el input se
 *    rotula "Recibido ahora" y el default es lo que falta para completar.
 *  - Internamente convertimos delta → total absoluto antes de mandar al
 *    backend, que espera `cantidadRecibida` como el total acumulado (no
 *    como delta). El service hace la cuenta.
 *
 * Validación cliente-side:
 *  - 0 ≤ recibido_ahora ≤ (cantidad - cantidad_recibida)
 *  - Al menos 1 item con recibido > 0 al confirmar
 *
 * El backend también valida, así que esto es solo para UX rápida —
 * cualquier error igual cae en el banner.
 *
 * Side effect via backend: al guardar, `materiales.stock_actual` sube
 * automáticamente por la cantidad recibida (es lo que hace el endpoint
 * /compras/:id/recibir).
 */
import { useState, useMemo } from 'react'
import { ComprasService } from '../services/compras.service'
import { formatCantidad } from '../constants'
import styles from './RecepcionModal.module.css'

export default function RecepcionModal({ compra, onClose, onSuccess }) {
  // Items que todavía tienen algo pendiente de recibir. Si ya recibimos
  // todo (RECIBIDA), el botón "Registrar recepción" no debería estar
  // visible — pero por defensiva, si llegamos acá y no hay nada pendiente,
  // mostramos un empty.
  const itemsPendientes = useMemo(() => {
    return (compra?.items ?? []).filter(it => {
      const pendiente = Number(it.cantidad) - Number(it.cantidad_recibida)
      return pendiente > 0
    })
  }, [compra])

  // State: por cada item pendiente, cuánto está recibiendo AHORA.
  // Default = lo que falta (recepción total en un click). Se setea en
  // useState con lazy init para no recalcular en cada render.
  const [recepciones, setRecepciones] = useState(() => {
    const map = {}
    for (const it of itemsPendientes) {
      const pendiente = Number(it.cantidad) - Number(it.cantidad_recibida)
      map[it.id] = String(pendiente)
    }
    return map
  })

  const [guardando, setGuardando] = useState(false)
  const [errAccion, setErrAccion] = useState(null)

  // Helpers de cálculo (todos parsean los inputs como Number con fallback 0)
  const recibidoAhora = (itemId) => {
    const v = Number(recepciones[itemId])
    return Number.isFinite(v) ? v : 0
  }
  const pendienteOriginal = (it) => Number(it.cantidad) - Number(it.cantidad_recibida)

  // Suma de todo lo que se está por recibir AHORA — para el indicador
  // del footer.
  const totalARecibir = itemsPendientes.reduce(
    (acc, it) => acc + recibidoAhora(it.id), 0
  )
  const itemsConAlgo = itemsPendientes.filter(it => recibidoAhora(it.id) > 0).length

  const handleChange = (itemId, valor) => {
    setRecepciones(prev => ({ ...prev, [itemId]: valor }))
  }

  // Atajos UX: poner todo en 0 (cancela una pre-fill) o todo el máximo.
  const setAll = (mode) => {
    setRecepciones(prev => {
      const next = { ...prev }
      for (const it of itemsPendientes) {
        next[it.id] = mode === 'max' ? String(pendienteOriginal(it)) : '0'
      }
      return next
    })
  }

  const validar = () => {
    if (itemsConAlgo === 0) {
      return 'Tenés que indicar al menos 1 item con cantidad > 0 para registrar la recepción.'
    }
    for (const it of itemsPendientes) {
      const ahora = recibidoAhora(it.id)
      const max = pendienteOriginal(it)
      if (ahora < 0) {
        return `Item "${it.material_nombre || it.material?.nombre}": no se puede recibir un valor negativo.`
      }
      if (ahora > max) {
        return `Item "${it.material_nombre || it.material?.nombre}": no podés recibir más de ${formatCantidad(max)} (es lo que falta para completar lo pedido).`
      }
    }
    return null
  }

  const handleSubmit = async () => {
    if (guardando) return
    const err = validar()
    if (err) { setErrAccion(err); return }

    setGuardando(true); setErrAccion(null)
    try {
      // Convertimos delta → total absoluto que espera el backend:
      // cantidadRecibida_total = cantidad_recibida_anterior + recibido_ahora
      // Filtramos los items con 0 para no mandarlos al pedo (el backend
      // los aceptaría pero generaría updates inútiles).
      const items = itemsPendientes
        .filter(it => recibidoAhora(it.id) > 0)
        .map(it => ({
          itemId: it.id,
          cantidadRecibida: Number(it.cantidad_recibida) + recibidoAhora(it.id),
        }))
      await ComprasService.recibir(compra.id, items)
      onSuccess?.()
    } catch (err) {
      setErrAccion(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Defensa: si por algún motivo llegamos acá sin items pendientes
  // (race condition o estado raro), mostramos algo coherente en vez
  // de un modal vacío.
  if (itemsPendientes.length === 0) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.card} onClick={e => e.stopPropagation()}>
          <h3 className={styles.title}>Nada para recibir</h3>
          <p className={styles.text}>
            Esta compra ya tiene todos los items recibidos. Si está en estado
            RECIBIDA_PARCIAL, refrescá la página.
          </p>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={() => !guardando && onClose()}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>Registrar recepción</h3>
        <p className={styles.subtitle}>
          {compra.numero} · {compra.proveedor_nombre || compra.proveedor?.nombre || ''}
        </p>

        {/* Atajos rápidos para no editar uno por uno cuando llega todo. */}
        <div className={styles.shortcuts}>
          <button type="button" className={styles.shortcut}
            onClick={() => setAll('max')} disabled={guardando}>
            Marcar todo como completo
          </button>
          <button type="button" className={styles.shortcut}
            onClick={() => setAll('zero')} disabled={guardando}>
            Limpiar todo
          </button>
        </div>

        <div className={styles.itemsWrapper}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>Material</th>
                <th className={styles.numCol}>Pedido</th>
                <th className={styles.numCol}>Ya recibido</th>
                <th className={styles.numCol}>Recibido ahora</th>
              </tr>
            </thead>
            <tbody>
              {itemsPendientes.map(it => {
                const max = pendienteOriginal(it)
                const ahora = recibidoAhora(it.id)
                const yaCompleto = Number(it.cantidad_recibida) > 0
                return (
                  <tr key={it.id} className={styles.itemRow}>
                    <td className={styles.cellMaterial}>
                      <div className={styles.materialNombre}>
                        {it.material_nombre || it.material?.nombre || '—'}
                      </div>
                      {it.material_unidad && (
                        <div className={styles.materialMeta}>Unidad: {it.material_unidad}</div>
                      )}
                    </td>
                    <td className={styles.cellNum}>{formatCantidad(it.cantidad)}</td>
                    <td className={`${styles.cellNum} ${yaCompleto ? styles.cellRecibidoPrevio : styles.cellMuted}`}>
                      {formatCantidad(it.cantidad_recibida)}
                    </td>
                    <td className={styles.cellInput}>
                      <input type="number"
                        min="0" max={max} step="any"
                        className={styles.inputNum}
                        value={recepciones[it.id] ?? ''}
                        onChange={e => handleChange(it.id, e.target.value)}
                        disabled={guardando} />
                      <span className={styles.maxHint}>/ {formatCantidad(max)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Resumen al pie: cuántos items y total. */}
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>
            {itemsConAlgo} item{itemsConAlgo !== 1 ? 's' : ''} ·{' '}
            <strong>{formatCantidad(totalARecibir)}</strong> unidades a sumar al stock
          </span>
        </div>

        {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost}
            onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className={styles.btnPrimary}
            onClick={handleSubmit} disabled={guardando}>
            {guardando ? 'Registrando...' : 'Confirmar recepción'}
          </button>
        </div>
      </div>
    </div>
  )
}
