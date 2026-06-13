// src/modules/m-compras/components/ComprobantePagoCard.jsx
/**
 * Card del comprobante de pago de una compra. Maneja los 3 estados:
 *
 *   - Cargando: spinner mientras se chequea si hay comprobante.
 *   - Sin comprobante: botón "Subir comprobante" + file picker oculto.
 *   - Con comprobante: link "Abrir/descargar" + botones "Reemplazar" y "Eliminar".
 *
 * Validación cliente-side antes de mandar (tipo y tamaño) para fallar rápido
 * y dar un mensaje claro sin esperar el round-trip al backend. El backend
 * valida lo mismo de cualquier forma (defensa en profundidad).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { LuFileText, LuUpload, LuTrash2 } from 'react-icons/lu'
import { ComprasService } from '../services/compras.service'
import styles from './ComprobantePagoCard.module.css'

const MIMES_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

function nombreDelPath(path) {
  if (!path) return null
  return path.split('/').pop()
}

export default function ComprobantePagoCard({ compraId }) {
  const [comprobante, setComprobante] = useState(null) // { url, path, expiresIn } | null
  const [loading,     setLoading]     = useState(true)
  const [subiendo,    setSubiendo]    = useState(false)
  const [eliminando,  setEliminando]  = useState(false)
  const [error,       setError]       = useState(null)
  const fileInputRef = useRef(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await ComprasService.getComprobante(compraId)
      setComprobante(data)
    } catch (err) {
      if (err.status === 404) {
        setComprobante(null) // no hay comprobante todavía — no es error
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [compraId])

  useEffect(() => { cargar() }, [cargar])

  const validarArchivo = (file) => {
    if (!MIMES_PERMITIDOS.includes(file.type)) {
      return 'Tipo no permitido. Subí un PDF, JPG o PNG.'
    }
    if (file.size > MAX_BYTES) {
      return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo es 5 MB.`
    }
    if (file.size === 0) {
      return 'El archivo está vacío.'
    }
    return null
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset para que se pueda volver a elegir el mismo archivo
    if (!file) return

    const errVal = validarArchivo(file)
    if (errVal) { setError(errVal); return }

    setSubiendo(true); setError(null)
    try {
      await ComprasService.uploadComprobante(compraId, file)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const handleEliminar = async () => {
    if (!window.confirm('¿Eliminar el comprobante de esta compra?')) return
    setEliminando(true); setError(null)
    try {
      await ComprasService.deleteComprobante(compraId)
      setComprobante(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  const ocupado = subiendo || eliminando

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Comprobante de pago</h2>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading ? (
        <div className={styles.loading}>Cargando…</div>
      ) : comprobante ? (
        <div className={styles.tieneComprobante}>
          <a href={comprobante.url} target="_blank" rel="noopener noreferrer"
             className={styles.linkComprobante}>
            <LuFileText size={20} />
            <span className={styles.linkText}>
              <span className={styles.linkLabel}>Abrir comprobante</span>
              <span className={styles.linkSub}>{nombreDelPath(comprobante.path)}</span>
            </span>
          </a>
          <div className={styles.acciones}>
            <button type="button" className={styles.btnGhost} disabled={ocupado}
              onClick={() => fileInputRef.current?.click()}>
              <LuUpload size={14} /> {subiendo ? 'Subiendo…' : 'Reemplazar'}
            </button>
            <button type="button" className={styles.btnDanger} disabled={ocupado}
              onClick={handleEliminar}>
              <LuTrash2 size={14} /> {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.sinComprobante}>
          <p className={styles.sinComprobanteTexto}>
            Todavía no cargaste el comprobante de pago (transferencia, recibo, etc.).
          </p>
          <button type="button" className={styles.btnPrimary} disabled={ocupado}
            onClick={() => fileInputRef.current?.click()}>
            <LuUpload size={16} /> {subiendo ? 'Subiendo…' : 'Subir comprobante'}
          </button>
          <p className={styles.hint}>Formatos: PDF, JPG o PNG. Máx. 5 MB.</p>
        </div>
      )}

      <input ref={fileInputRef} type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={handleFile} hidden />
    </section>
  )
}
