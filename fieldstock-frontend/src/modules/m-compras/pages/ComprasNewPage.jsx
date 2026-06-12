// src/modules/m-compras/pages/ComprasNewPage.jsx
/**
 * Form para crear una orden de compra en BORRADOR.
 *
 * Parte 2/6 del módulo Compras. La compra queda en BORRADOR, editable
 * desde el DetailPage (parte 6) y confirmable desde ahí (parte 4).
 *
 * Diseño del form:
 *   - Cabecera: proveedor + medio de pago + observaciones
 *   - Items dinámicos: cada fila es {material, cantidad, precio_unitario}.
 *     Subtotal calculado en vivo, total al pie.
 *   - Validación cliente-side mínima: al menos 1 item, proveedor seleccionado,
 *     cantidad > 0 en cada item. El backend valida más a fondo (precios >= 0,
 *     material activo, etc.) — si falla, se muestra el error tal cual.
 *
 * Al guardar: POST /compras con { proveedor_id, medio_pago, observaciones,
 * items: [...] } → redirige al detalle de la compra recién creada.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ComprasService } from '../services/compras.service'
import { ProveedoresService } from '@modules/m7-directorio/services/directorio.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import styles from './ComprasNewPage.module.css'

const MEDIOS_PAGO = [
  { value: 'EFECTIVO',         label: 'Efectivo' },
  { value: 'TRANSFERENCIA',    label: 'Transferencia' },
  { value: 'CHEQUE',           label: 'Cheque' },
  { value: 'TARJETA',          label: 'Tarjeta' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta corriente' },
]

// Cada item del form arranca con esta forma. El uid local sirve solo para
// la key de React mientras el item no tenga id de DB todavía.
const nuevoItemVacio = () => ({
  uid: Math.random().toString(36).slice(2, 9),
  material_id:     '',
  cantidad:        '',
  precio_unitario: '',
})

function formatMoney(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '$0,00'
  return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
}

export default function ComprasNewPage() {
  const navigate = useNavigate()

  // ── Datos de los selects (proveedores + materiales) ─────────────
  const [proveedores, setProveedores] = useState([])
  const [materiales,  setMateriales]  = useState([])
  const [loadingRef,  setLoadingRef]  = useState(true)
  const [errRef,      setErrRef]      = useState(null)

  useEffect(() => {
    let cancelado = false
    Promise.all([
      ProveedoresService.getAll(),
      MaterialesService.getAll(),
    ])
      .then(([prov, mat]) => {
        if (cancelado) return
        setProveedores(Array.isArray(prov) ? prov : [])
        setMateriales(Array.isArray(mat) ? mat : [])
      })
      .catch(err => { if (!cancelado) setErrRef(err.message) })
      .finally(() => { if (!cancelado) setLoadingRef(false) })
    return () => { cancelado = true }
  }, [])

  // ── State del form ─────────────────────────────────────────────
  const [proveedorId,    setProveedorId]    = useState('')
  const [medioPago,      setMedioPago]      = useState('EFECTIVO')
  const [observaciones,  setObservaciones]  = useState('')
  const [items,          setItems]          = useState([nuevoItemVacio()])
  const [guardando,      setGuardando]      = useState(false)
  const [errGuardar,     setErrGuardar]     = useState(null)

  // ── Helpers de manipulación de items ────────────────────────────
  const updateItem = (uid, campo, valor) => {
    setItems(prev => prev.map(it => it.uid === uid ? { ...it, [campo]: valor } : it))
  }
  const addItem = () => setItems(prev => [...prev, nuevoItemVacio()])
  const removeItem = (uid) => setItems(prev => prev.filter(it => it.uid !== uid))

  // ── Cálculo del total en vivo ──────────────────────────────────
  // Los inputs son strings, pasamos a Number con fallback 0. Si una fila
  // tiene cantidad o precio inválidos no rompe — suma 0 a ese item.
  const calcSubtotal = (it) => {
    const cant = Number(it.cantidad)
    const prec = Number(it.precio_unitario)
    if (!Number.isFinite(cant) || !Number.isFinite(prec)) return 0
    return cant * prec
  }
  const total = items.reduce((acc, it) => acc + calcSubtotal(it), 0)

  // ── Validación + submit ────────────────────────────────────────
  // Devolvemos primer error encontrado (o null si OK) — UX directa, sin
  // marcar TODOS los errores a la vez para no abrumar.
  const validar = () => {
    if (!proveedorId) return 'Tenés que elegir un proveedor.'
    if (items.length === 0) return 'La compra tiene que tener al menos 1 item.'
    for (const [idx, it] of items.entries()) {
      if (!it.material_id) return `Item ${idx + 1}: elegí un material.`
      const cant = Number(it.cantidad)
      if (!Number.isFinite(cant) || cant <= 0) return `Item ${idx + 1}: la cantidad debe ser mayor a 0.`
      const prec = Number(it.precio_unitario)
      if (!Number.isFinite(prec) || prec < 0) return `Item ${idx + 1}: el precio no puede ser negativo.`
    }
    // Materiales duplicados en distintas filas: lo permitimos por ahora
    // (puede tener sentido si vienen en distintas tandas/precios), pero
    // valdría warning visual si se vuelve frecuente.
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (guardando) return
    const err = validar()
    if (err) { setErrGuardar(err); return }

    setGuardando(true); setErrGuardar(null)
    try {
      const compra = await ComprasService.create({
        proveedor_id:  proveedorId,
        medio_pago:    medioPago,
        observaciones: observaciones.trim() || null,
        items: items.map(it => ({
          material_id:     it.material_id,
          cantidad:        Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
        })),
      })
      // El backend devuelve la compra creada con su id. Redirigimos al
      // detalle (parte 3 todavía no implementada → cae a ComingSoon
      // pero el id queda en la URL).
      const id = compra?.id || compra?.data?.id
      if (id) navigate(`/compras/${id}`)
      else navigate('/compras')
    } catch (err) {
      setErrGuardar(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Nueva compra</h1>
          <p className={styles.subtitle}>Creá una orden de compra para reponer stock de un proveedor.</p>
        </div>
        <button className={styles.btnGhost} type="button" onClick={() => navigate('/compras')}>
          ← Volver
        </button>
      </div>

      {errRef && <div className={styles.errorBanner}>⚠ No se pudo cargar proveedores o materiales: {errRef}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>

        {/* ── Card 1: Datos generales ────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Datos generales</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="proveedor">Proveedor *</label>
            <select id="proveedor" className={styles.select}
              value={proveedorId} onChange={e => setProveedorId(e.target.value)}
              disabled={loadingRef} required>
              <option value="">{loadingRef ? 'Cargando...' : '— Elegí un proveedor —'}</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>
                  {p.razon_social || p.nombre || 'Sin nombre'}
                  {p.rubro ? ` · ${p.rubro}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="medio">Medio de pago</label>
              <select id="medio" className={styles.select}
                value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                {MEDIOS_PAGO.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="obs">Observaciones</label>
            <textarea id="obs" className={styles.textarea}
              rows={2}
              placeholder="Notas internas sobre la compra (opcional)"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)} />
          </div>
        </section>

        {/* ── Card 2: Items ──────────────────────────────────── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Items</h2>
            <button type="button" className={styles.btnLink} onClick={addItem}>
              + Agregar item
            </button>
          </div>

          {items.length === 0 ? (
            <div className={styles.itemsEmpty}>
              No hay items. Agregá al menos uno.
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => {
                    const mat = materiales.find(m => m.id === it.material_id)
                    return (
                      <tr key={it.uid} className={styles.itemRow}>
                        <td className={styles.cellMaterial} data-label="Material">
                          <select className={styles.selectMaterial}
                            value={it.material_id}
                            onChange={e => updateItem(it.uid, 'material_id', e.target.value)}
                            disabled={loadingRef}>
                            <option value="">{loadingRef ? 'Cargando...' : '— Elegí material —'}</option>
                            {materiales.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.nombre}{m.marca ? ` (${m.marca})` : ''}
                              </option>
                            ))}
                          </select>
                          {mat && <div className={styles.materialMeta}>Unidad: {mat.unidad || 'unidad'}</div>}
                        </td>
                        <td className={styles.cellNum} data-label="Cantidad">
                          <input type="number" min="0" step="any"
                            className={styles.inputNum}
                            placeholder="0"
                            value={it.cantidad}
                            onChange={e => updateItem(it.uid, 'cantidad', e.target.value)} />
                        </td>
                        <td className={styles.cellNum} data-label="Precio unit.">
                          <input type="number" min="0" step="0.01"
                            className={styles.inputNum}
                            placeholder="0,00"
                            value={it.precio_unitario}
                            onChange={e => updateItem(it.uid, 'precio_unitario', e.target.value)} />
                        </td>
                        <td className={styles.cellSubtotal} data-label="Subtotal">
                          {formatMoney(calcSubtotal(it))}
                        </td>
                        <td className={styles.cellActions}>
                          <button type="button" className={styles.btnRemoveItem}
                            onClick={() => removeItem(it.uid)}
                            title="Borrar item"
                            disabled={items.length === 1}>
                            🗑
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className={styles.totalLabel}>Total</td>
                    <td className={styles.totalValue}>{formatMoney(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ── Footer del form: error + botones ──────────────── */}
        {errGuardar && <div className={styles.errorBanner}>⚠ {errGuardar}</div>}

        <div className={styles.footerActions}>
          <button type="button" className={styles.btnGhost}
            onClick={() => navigate('/compras')} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary}
            disabled={guardando || loadingRef}>
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
        </div>
      </form>
    </div>
  )
}
