// src/modules/m6-materiales/pages/MateriasNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialesService } from '../services/materiales.service'
import styles from './MateriasNewPage.module.css'

const UNIDADES = ['unidad','kg','metro','litro','caja','rollo','juego','par']
const INICIAL  = { nombre: '', descripcion: '', marca: '', unidad: 'unidad', stockActual: '', stockMinimo: '' }

export default function MateriasNewPage() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(false)
  const [guardado,setGuardado]= useState(null)
  // Lista de marcas ya usadas para autocomplete del input (Word #17)
  const [marcasExistentes, setMarcasExistentes] = useState([])

  useEffect(() => {
    MaterialesService.getMarcas()
      .then(setMarcasExistentes)
      .catch(() => {})  // No crítico — el input sigue siendo libre
  }, [])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (form.stockActual !== '' && isNaN(Number(form.stockActual))) e.stockActual = 'Ingresá un número válido.'
    if (form.stockMinimo !== '' && isNaN(Number(form.stockMinimo))) e.stockMinimo = 'Ingresá un número válido.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setLoading(true)
    try {
      const mat = await MaterialesService.create({
        nombre:      form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        marca:       form.marca.trim() || null,
        unidad:      form.unidad,
        stockActual: form.stockActual ? Number(form.stockActual) : 0,
        stockMinimo: form.stockMinimo ? Number(form.stockMinimo) : 0,
      })
      setGuardado(mat)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setLoading(false) }
  }

  if (guardado) return (
    <div className={styles.exito}>
      <div className={styles.exitoCard}>
        <span className={styles.exitoIcon}>✓</span>
        <h2 className={styles.exitoTitle}>Material registrado</h2>
        <p className={styles.exitoNombre}>{guardado.nombre}</p>
        <p className={styles.exitoStock}>Stock inicial: {guardado.stock_actual} {guardado.unidad}</p>
        <div className={styles.exitoActions}>
          <button className={styles.btnPrimary} onClick={() => navigate('/materiales')}>Ver catálogo</button>
          <button className={styles.btnGhost}   onClick={() => { setForm(INICIAL); setGuardado(null) }}>Registrar otro</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/materiales')}>← Volver</button>
        <div>
          <h1 className={styles.title}>Nuevo material</h1>
          <p className={styles.subtitle}>Agregá un material o insumo al catálogo.</p>
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
                placeholder="Ej: Bulones M12 x 50mm"
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="unidad">Unidad de medida</label>
              <select id="unidad" className={styles.select}
                value={form.unidad} onChange={e => set('unidad', e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
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
              {/* datalist habilita autocomplete con marcas ya usadas (Word #17 + #20) */}
              <datalist id="marcas-existentes">
                {marcasExistentes.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="descripcion">Descripción <span className={styles.optional}>(opcional)</span></label>
              <input id="descripcion" type="text" className={styles.input}
                placeholder="Especificaciones, uso habitual..."
                value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Stock</legend>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stockActual">Stock inicial</label>
              <input id="stockActual" type="number" min="0" step="0.01"
                className={`${styles.input} ${errores.stockActual ? styles.inputError : ''}`}
                placeholder="0"
                value={form.stockActual} onChange={e => set('stockActual', e.target.value)} />
              {errores.stockActual && <span className={styles.error}>{errores.stockActual}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stockMinimo">
                Stock mínimo <span className={styles.optional}>(alerta)</span>
              </label>
              <input id="stockMinimo" type="number" min="0" step="0.01"
                className={`${styles.input} ${errores.stockMinimo ? styles.inputError : ''}`}
                placeholder="0"
                value={form.stockMinimo} onChange={e => set('stockMinimo', e.target.value)} />
              {errores.stockMinimo && <span className={styles.error}>{errores.stockMinimo}</span>}
            </div>
          </div>
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/materiales')}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar material'}
          </button>
        </div>

      </form>
    </div>
  )
}
