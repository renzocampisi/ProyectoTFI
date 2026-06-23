// src/modules/m-presupuestos/pages/PresupuestoNewPage.jsx
/**
 * Form de creación de presupuesto. Llega desde el botón "+ Nuevo
 * presupuesto" en la página de una obra con `?obraId=<uuid>` en el
 * query string.
 *
 * Estructura:
 *   - Cabecera: obra (read-only), %ganancia (prellenado con default
 *     global), observaciones.
 *   - Insumos: tabla dinámica de materiales. Al elegir un material,
 *     el precio se autocompleta con el último precio de compra (si
 *     existe). El operador puede sobreescribirlo.
 *   - 5 secciones de costos opcionales (mano de obra, viáticos,
 *     seguros, personal extra, otros). Cada una con sus filas
 *     dinámicas. La sección vacía no genera items.
 *   - Total al pie, recalculado en vivo cliente-side.
 *
 * Submit: crea el presupuesto vacío via POST y después agrega cada
 * item via los endpoints específicos. Si algún add falla, se elimina
 * el presupuesto recién creado (rollback manual — el backend no expone
 * transacciones para insert-cabecera-y-detalle).
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { PresupuestosService, ConfigService } from '../services/presupuestos.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import { CATEGORIAS, CATEGORIA_INFO, formatMoney } from '../constants'
import styles from './PresupuestoNewPage.module.css'

const UNIDADES_COSTO = ['horas', 'días', 'km', 'global', 'unidad', 'mes']

// uid local para keys de filas no persistidas
let _uid = 0
const nextUid = () => `tmp-${++_uid}`

function nuevaFilaInsumo() {
  return { uid: nextUid(), materialId: '', cantidad: '', precio: '' }
}
function nuevaFilaCosto(categoria) {
  return {
    uid: nextUid(), categoria,
    descripcion: '', cantidad: '1', unidad: '', costo: '',
  }
}

export default function PresupuestoNewPage() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const obraId       = searchParams.get('obraId') || ''

  // ── State cabecera ─────────────────────────────────────────
  const [obra,          setObra]          = useState(null)
  const [loadingObra,   setLoadingObra]   = useState(true)
  const [pctGanancia,   setPctGanancia]   = useState('10')
  const [observaciones, setObservaciones] = useState('')

  // ── State items ────────────────────────────────────────────
  const [materiales, setMateriales] = useState([])
  const [insumos,    setInsumos]    = useState([nuevaFilaInsumo()])
  // costos: { MANO_OBRA: [...], VIATICOS: [...], ... }
  const [costos, setCostos] = useState(() =>
    Object.fromEntries(CATEGORIAS.map(c => [c, []])))

  // ── State submit ───────────────────────────────────────────
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState(null)

  // ── Cargas iniciales ───────────────────────────────────────
  useEffect(() => {
    if (!obraId) {
      setError('Falta obraId. Volvé a la obra y usá el botón "+ Nuevo presupuesto".')
      setLoadingObra(false)
      return
    }
    ObrasService.getById(obraId)
      .then(setObra)
      .catch(err => setError(err.message))
      .finally(() => setLoadingObra(false))
  }, [obraId])

  useEffect(() => {
    MaterialesService.getAll().then(setMateriales).catch(() => setMateriales([]))
  }, [])

  // Cargar % default de config global
  useEffect(() => {
    ConfigService.get('porcentaje_ganancia_default')
      .then(data => { if (data?.value) setPctGanancia(String(data.value)) })
      .catch(() => {}) // sin default → se queda en 10
  }, [])

  // ── Total cliente-side (para feedback en vivo) ─────────────
  const totales = useMemo(() => {
    const subInsumos = insumos.reduce((s, i) => {
      const c = Number(i.cantidad), p = Number(i.precio)
      return s + (Number.isFinite(c) && Number.isFinite(p) ? c * p : 0)
    }, 0)
    const subCostos = Object.values(costos).flat().reduce((s, c) => {
      const cant = Number(c.cantidad), cu = Number(c.costo)
      return s + (Number.isFinite(cant) && Number.isFinite(cu) ? cant * cu : 0)
    }, 0)
    const pct = Number(pctGanancia) || 0
    const ganancia = subInsumos * (pct / 100)
    return { subInsumos, subCostos, ganancia, total: subInsumos + ganancia + subCostos }
  }, [insumos, costos, pctGanancia])

  // ── Handlers insumos ───────────────────────────────────────
  const updateInsumo = (uid, field, value) =>
    setInsumos(rows => rows.map(r => r.uid === uid ? { ...r, [field]: value } : r))

  const addInsumo    = () => setInsumos(rows => [...rows, nuevaFilaInsumo()])
  const removeInsumo = (uid) => setInsumos(rows =>
    rows.length === 1 ? rows : rows.filter(r => r.uid !== uid))

  // Cuando el user elige un material → consultar precio de referencia
  // y autocompletar el campo. Si 404, dejar vacío.
  const onPickMaterial = async (uid, materialId) => {
    updateInsumo(uid, 'materialId', materialId)
    if (!materialId) return
    try {
      const data = await MaterialesService.getPrecioReferencia(materialId)
      if (data?.precio !== undefined) updateInsumo(uid, 'precio', String(data.precio))
    } catch (err) {
      // 404 = nunca se compró → no tocamos el precio, el user lo escribe
      if (err.status !== 404) console.warn('[precio-referencia]', err.message)
    }
  }

  // ── Handlers costos ────────────────────────────────────────
  const addCosto = (cat) => setCostos(c => ({
    ...c, [cat]: [...c[cat], nuevaFilaCosto(cat)],
  }))
  const removeCosto = (cat, uid) => setCostos(c => ({
    ...c, [cat]: c[cat].filter(r => r.uid !== uid),
  }))
  const updateCosto = (cat, uid, field, value) => setCostos(c => ({
    ...c, [cat]: c[cat].map(r => r.uid === uid ? { ...r, [field]: value } : r),
  }))

  // ── Submit ─────────────────────────────────────────────────
  const validar = () => {
    const pct = Number(pctGanancia)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 'El % de ganancia debe estar entre 0 y 100.'

    // Insumos: filtramos vacíos pero validamos los que tienen al menos algún dato
    const insumosValidos = insumos.filter(i => i.materialId || i.cantidad || i.precio)
    for (const [idx, i] of insumosValidos.entries()) {
      if (!i.materialId) return `Insumo ${idx + 1}: elegí un material.`
      const c = Number(i.cantidad), p = Number(i.precio)
      if (!Number.isFinite(c) || c <= 0) return `Insumo ${idx + 1}: la cantidad debe ser mayor a 0.`
      if (!Number.isFinite(p) || p < 0)  return `Insumo ${idx + 1}: el precio no puede ser negativo.`
    }

    const costosValidos = []
    for (const [cat, rows] of Object.entries(costos)) {
      for (const [idx, c] of rows.entries()) {
        if (!c.descripcion?.trim() && !c.cantidad && !c.costo) continue
        if (!c.descripcion?.trim()) return `${CATEGORIA_INFO[cat].label} #${idx + 1}: falta descripción.`
        const cant = Number(c.cantidad), cu = Number(c.costo)
        if (!Number.isFinite(cant) || cant <= 0) return `${CATEGORIA_INFO[cat].label} #${idx + 1}: cantidad debe ser > 0.`
        if (!Number.isFinite(cu)   || cu   <  0) return `${CATEGORIA_INFO[cat].label} #${idx + 1}: costo no puede ser negativo.`
        costosValidos.push(c)
      }
    }

    if (insumosValidos.length === 0 && costosValidos.length === 0) {
      return 'Agregá al menos un insumo o un costo antes de guardar.'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (guardando) return

    const err = validar()
    if (err) { setError(err); return }

    setGuardando(true); setError(null)

    let presupuestoCreado = null
    try {
      // 1) Crear el presupuesto vacío
      presupuestoCreado = await PresupuestosService.create({
        obraId,
        porcentajeGanancia: Number(pctGanancia),
        observaciones:      observaciones.trim() || null,
      })

      // 2) Agregar insumos (filtrar vacíos)
      const insumosOk = insumos.filter(i => i.materialId)
      for (const i of insumosOk) {
        await PresupuestosService.addInsumo(presupuestoCreado.id, {
          materialId:     i.materialId,
          cantidad:       Number(i.cantidad),
          precioUnitario: Number(i.precio),
        })
      }

      // 3) Agregar costos (filtrar filas no completas)
      for (const [cat, rows] of Object.entries(costos)) {
        for (const c of rows) {
          if (!c.descripcion?.trim()) continue
          await PresupuestosService.addCosto(presupuestoCreado.id, {
            categoria:     cat,
            descripcion:   c.descripcion.trim(),
            cantidad:      Number(c.cantidad),
            unidad:        c.unidad?.trim() || null,
            costoUnitario: Number(c.costo),
          })
        }
      }

      navigate(`/presupuestos/${presupuestoCreado.id}`)
    } catch (errSubmit) {
      // Rollback manual: si fallo agregando items, eliminar el presupuesto
      if (presupuestoCreado?.id) {
        await PresupuestosService.remove(presupuestoCreado.id).catch(() => {})
      }
      setError(errSubmit.message)
      setGuardando(false)
    }
  }

  if (loadingObra) return <div className={styles.loading}>Cargando obra...</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.btnBack} type="button" onClick={() => navigate(-1)}>← Volver</button>
        <h1 className={styles.title}>Nuevo presupuesto</h1>
        {obra && (
          <p className={styles.subtitle}>
            Para la obra <Link to={`/obras/${obra.id}`} className={styles.linkObra}>{obra.nombre}</Link>
            {obra.cliente && <> · Cliente: {obra.cliente}</>}
          </p>
        )}
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* ── Cabecera ──────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Cabecera</h2>
          <div className={styles.fieldsGrid}>
            <div className={styles.field}>
              <label htmlFor="pct" className={styles.label}>% Ganancia (sobre insumos)</label>
              <input id="pct" type="number" min="0" max="100" step="0.5"
                className={styles.input}
                value={pctGanancia}
                onChange={e => setPctGanancia(e.target.value)} />
              <span className={styles.hint}>El % aplica solo al subtotal de insumos. Los costos extra van sin markup.</span>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="obs" className={styles.label}>Observaciones <span className={styles.opcional}>(opcional)</span></label>
            <textarea id="obs" rows={3} className={styles.textarea}
              placeholder="Notas internas o aclaraciones para el cliente..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)} />
          </div>
        </section>

        {/* ── Insumos ───────────────────────────────────────── */}
        <section className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardTitle}>Insumos</h2>
            <button type="button" className={styles.btnLink} onClick={addInsumo}>+ Agregar insumo</button>
          </div>
          <div className={styles.itemsList}>
            {insumos.map((i, idx) => (
              <div key={i.uid} className={styles.itemRow}>
                <div className={styles.itemNum}>{idx + 1}</div>
                <div className={styles.itemFields}>
                  <select className={styles.input}
                    value={i.materialId}
                    onChange={e => onPickMaterial(i.uid, e.target.value)}>
                    <option value="">— Elegí un material —</option>
                    {materiales.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}{m.marca ? ` · ${m.marca}` : ''} ({m.unidad})
                      </option>
                    ))}
                  </select>
                  <input type="number" min="0" step="0.01" placeholder="Cant."
                    className={styles.inputNum}
                    value={i.cantidad}
                    onChange={e => updateInsumo(i.uid, 'cantidad', e.target.value)} />
                  <input type="number" min="0" step="0.01" placeholder="Precio unit."
                    className={styles.inputNum}
                    value={i.precio}
                    onChange={e => updateInsumo(i.uid, 'precio', e.target.value)} />
                  <div className={styles.subtotal}>
                    {formatMoney((Number(i.cantidad) || 0) * (Number(i.precio) || 0))}
                  </div>
                  <button type="button" className={styles.btnRemove}
                    onClick={() => removeInsumo(i.uid)}
                    disabled={insumos.length === 1}
                    title={insumos.length === 1 ? 'Necesitás al menos una fila' : 'Quitar'}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5 secciones de costos ────────────────────────── */}
        {CATEGORIAS.map(cat => {
          const rows = costos[cat]
          const info = CATEGORIA_INFO[cat]
          return (
            <section key={cat} className={styles.card}>
              <div className={styles.cardHeaderRow}>
                <h2 className={styles.cardTitle}>
                  {info.icon} {info.label}
                  <span className={styles.opcional}>(opcional)</span>
                </h2>
                <button type="button" className={styles.btnLink} onClick={() => addCosto(cat)}>+ Agregar</button>
              </div>
              {rows.length === 0 ? (
                <p className={styles.emptyCat}>Sin items. No se incluirá en el total si queda vacía.</p>
              ) : (
                <div className={styles.itemsList}>
                  {rows.map((c, idx) => (
                    <div key={c.uid} className={styles.itemRow}>
                      <div className={styles.itemNum}>{idx + 1}</div>
                      <div className={styles.itemFields}>
                        <input type="text" placeholder="Descripción (ej. Electricista a domicilio)"
                          className={styles.input}
                          value={c.descripcion}
                          onChange={e => updateCosto(cat, c.uid, 'descripcion', e.target.value)} />
                        <input type="number" min="0" step="1" placeholder="Cant."
                          className={styles.inputNum}
                          value={c.cantidad}
                          onChange={e => updateCosto(cat, c.uid, 'cantidad', e.target.value)} />
                        <select className={styles.inputSm}
                          value={c.unidad}
                          onChange={e => updateCosto(cat, c.uid, 'unidad', e.target.value)}>
                          <option value="">unidad…</option>
                          {UNIDADES_COSTO.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input type="number" min="0" step="0.01" placeholder="Costo unit."
                          className={styles.inputNum}
                          value={c.costo}
                          onChange={e => updateCosto(cat, c.uid, 'costo', e.target.value)} />
                        <div className={styles.subtotal}>
                          {formatMoney((Number(c.cantidad) || 0) * (Number(c.costo) || 0))}
                        </div>
                        <button type="button" className={styles.btnRemove}
                          onClick={() => removeCosto(cat, c.uid)} title="Quitar">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {/* ── Total ────────────────────────────────────────── */}
        <section className={styles.cardTotal}>
          <div className={styles.totalRow}>
            <span>Subtotal insumos</span>
            <span>{formatMoney(totales.subInsumos)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>+ Ganancia ({pctGanancia || 0}% sobre insumos)</span>
            <span>{formatMoney(totales.ganancia)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>+ Costos extra</span>
            <span>{formatMoney(totales.subCostos)}</span>
          </div>
          <div className={`${styles.totalRow} ${styles.totalFinal}`}>
            <span>Total</span>
            <span>{formatMoney(totales.total)}</span>
          </div>
        </section>

        {error && <div className={styles.errorBanner}>⚠ {error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost}
            onClick={() => navigate(-1)}
            disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={guardando || !obraId}>
            {guardando ? 'Guardando…' : 'Crear presupuesto'}
          </button>
        </div>
      </form>
    </div>
  )
}
