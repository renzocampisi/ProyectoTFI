// src/modules/m6-materiales/pages/MateriasEditPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MaterialesService } from '../services/materiales.service'
import styles from './MateriasNewPage.module.css'

const UNIDADES_BASE = ['unidad','kg','metro','litro','caja','rollo','juego','par']
const STORAGE_UNIDADES = 'fs-unidades-extra'

// Lee las unidades custom guardadas en localStorage (Word #21).
// Misma key que MateriasNewPage para compartirlas.
function loadUnidadesExtra() {
  try {
    const raw = localStorage.getItem(STORAGE_UNIDADES)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export default function MateriasEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form,    setForm]    = useState(null)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [guardado,setGuardado]= useState(false)
  // Marcas existentes para autocomplete (Word #17)
  const [marcasExistentes, setMarcasExistentes] = useState([])

  useEffect(() => {
    // Cargar el material + las marcas existentes en paralelo
    Promise.all([
      MaterialesService.getById(id),
      MaterialesService.getMarcas().catch(() => []),  // No crítico
    ])
      .then(([mat, marcas]) => {
        setForm({
          nombre:      mat.nombre       || '',
          descripcion: mat.descripcion  || '',
          marca:       mat.marca        || '',
          unidad:      mat.unidad       || 'unidad',
          stockActual: mat.stock_actual ?? 0,
          stockMinimo: mat.stock_minimo ?? 0,
        })
        setMarcasExistentes(marcas)
        setLoading(false)
      })
      .catch(() => navigate('/materiales'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (isNaN(Number(form.stockActual)) || Number(form.stockActual) < 0) e.stockActual = 'Ingresá un número válido.'
    if (isNaN(Number(form.stockMinimo)) || Number(form.stockMinimo) < 0) e.stockMinimo = 'Ingresá un número válido.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setSaving(true)
    try {
      await MaterialesService.update(id, {
        nombre:      form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        marca:       form.marca.trim() || null,
        unidad:      form.unidad,
        stockActual: Number(form.stockActual),
        stockMinimo: Number(form.stockMinimo),
      })
      setGuardado(true)
      setTimeout(() => navigate('/materiales'), 1200)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className={styles.page}>
      <p style={{ color: 'var(--text-secondary)' }}>Cargando...</p>
    </div>
  )

  if (guardado) return (
    <div className={styles.exito}>
      <div className={styles.exitoCard}>
        <span className={styles.exitoIcon}>✓</span>
        <h2 className={styles.exitoTitle}>Cambios guardados</h2>
        <p className={styles.exitoNombre}>Redirigiendo al catálogo...</p>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/materiales')}>← Volver</button>
        <div>
          <h1 className={styles.title}>Editar material</h1>
          <p className={styles.subtitle}>Podés corregir datos o ajustar el stock.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Identificación</legend>
          <div className={styles.grid2}>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="nombre">Nombre <span className={styles.req}>*</span></label>
              <input id="nombre" type="text"
                className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="unidad">Unidad de medida</label>
              <select id="unidad" className={styles.select}
                value={form.unidad} onChange={e => set('unidad', e.target.value)}>
                {/* Word #21: unidades base + custom de localStorage + la actual
                    del material si no está en ninguna lista (caso edge: el material
                    tenía una unidad rara guardada en su momento) */}
                {[...new Set([...UNIDADES_BASE, ...loadUnidadesExtra(), form.unidad].filter(Boolean))]
                  .map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="marca">
                Marca <span className={styles.optional}>(opcional)</span>
              </label>
              <input id="marca" type="text" className={styles.input}
                list="marcas-existentes"
                placeholder="Ej: Tacsa, Roda, Precincor"
                value={form.marca} onChange={e => set('marca', e.target.value)} />
              <datalist id="marcas-existentes">
                {marcasExistentes.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="descripcion">Descripción <span className={styles.optional}>(opcional)</span></label>
              <input id="descripcion" type="text" className={styles.input}
                value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Stock</legend>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stockActual">Stock actual</label>
              <input id="stockActual" type="number" min="0" step="0.01"
                className={`${styles.input} ${errores.stockActual ? styles.inputError : ''}`}
                value={form.stockActual} onChange={e => set('stockActual', e.target.value)} />
              {errores.stockActual && <span className={styles.error}>{errores.stockActual}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stockMinimo">
                Stock mínimo <span className={styles.optional}>(alerta)</span>
              </label>
              <input id="stockMinimo" type="number" min="0" step="0.01"
                className={`${styles.input} ${errores.stockMinimo ? styles.inputError : ''}`}
                value={form.stockMinimo} onChange={e => set('stockMinimo', e.target.value)} />
              {errores.stockMinimo && <span className={styles.error}>{errores.stockMinimo}</span>}
            </div>
          </div>
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/materiales')}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

      </form>
    </div>
  )
}
