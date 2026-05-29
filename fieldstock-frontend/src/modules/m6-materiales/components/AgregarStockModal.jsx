// src/modules/m6-materiales/components/AgregarStockModal.jsx
/**
 * Modal para sumar stock a un material existente desde el catálogo (Word A).
 *
 * Disparado desde el botón "+ Stock" de cada fila en MateriasListPage.
 * Pide una cantidad, llama POST /materiales/:id/agregar-stock, y avisa
 * al parent del nuevo stock para refrescar la lista.
 *
 * Reutiliza el endpoint backend creado en el PR #B (detección de duplicados)
 * — el mismo `POST /materiales/:id/agregar-stock` que se llamaba cuando el
 * usuario decidía "sumar al existente" desde el modal de duplicado.
 */
import { useState } from 'react'
import { MaterialesService } from '../services/materiales.service'
import styles from './AgregarStockModal.module.css'

export default function AgregarStockModal({ material, onClose, onSuccess }) {
  const [cantidad,   setCantidad]   = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error,      setError]      = useState(null)

  const num = Number(cantidad)
  const valida = cantidad !== '' && Number.isFinite(num) && num > 0
  const nuevoStock = valida ? material.stock_actual + num : material.stock_actual

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!valida) {
      setError('Ingresá una cantidad mayor a 0.'); return
    }
    setProcesando(true); setError(null)
    try {
      const matActualizado = await MaterialesService.agregarStock(material.id, num)
      onSuccess?.(matActualizado)
    } catch (err) {
      setError(err.message)
      setProcesando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.card} onClick={e => e.stopPropagation()} onSubmit={handleSubmit} noValidate>
        <div className={styles.icon}>📦</div>
        <h2 className={styles.title}>Agregar stock</h2>

        <div className={styles.matCard}>
          <div className={styles.matNombre}>{material.nombre}</div>
          {material.marca && <div className={styles.matMarca}>{material.marca}</div>}
          <div className={styles.matStats}>
            <span>Stock actual:</span>
            <strong>{material.stock_actual} {material.unidad}</strong>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cantidad">
            Cantidad a sumar <span className={styles.req}>*</span>
          </label>
          <div className={styles.inputRow}>
            <input id="cantidad" type="number" min="0" step="0.01"
              className={styles.input}
              placeholder="Ej: 50"
              value={cantidad}
              onChange={e => { setCantidad(e.target.value); setError(null) }}
              autoFocus
              disabled={procesando} />
            <span className={styles.unidadTag}>{material.unidad}</span>
          </div>
          {valida && (
            <span className={styles.preview}>
              → Stock final: <strong>{nuevoStock} {material.unidad}</strong>
            </span>
          )}
        </div>

        {error && <div className={styles.error}>⚠ {error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost}
            onClick={onClose} disabled={procesando}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary}
            disabled={procesando || !valida}>
            {procesando ? 'Sumando...' : '✓ Sumar al stock'}
          </button>
        </div>
      </form>
    </div>
  )
}
