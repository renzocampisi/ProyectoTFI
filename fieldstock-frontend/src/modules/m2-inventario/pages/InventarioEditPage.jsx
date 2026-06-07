// src/modules/m2-inventario/pages/InventarioEditPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { InventarioService } from '../services/inventario.service'
import styles from './InventarioNewPage.module.css' // reutiliza los mismos estilos

const AÑO_ACTUAL = new Date().getFullYear()
const AÑOS = Array.from({ length: 20 }, (_, i) => AÑO_ACTUAL - i)

export default function InventarioEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form,       setForm]       = useState(null)
  const [categorias, setCategorias] = useState([])
  const [errores,    setErrores]    = useState({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [guardado,   setGuardado]   = useState(false)

  useEffect(() => {
    Promise.all([
      InventarioService.getById(id),
      InventarioService.getCategorias(),
    ]).then(([herr, cats]) => {
      setForm({
        nombre:      herr.nombre       || '',
        categoriaId: herr.categoria_id || '',
        marca:       herr.marca        || '',
        modelo:      herr.modelo       || '',
        numeroSerie: herr.numero_serie || '',
        descripcion: herr.descripcion  || '',
        añoCompra:   herr.anio_compra  || '',
        valor:       herr.valor        || '',
        importante:  herr.importante   === true,
      })
      setCategorias(cats)
      setLoading(false)
    }).catch(() => navigate('/herramientas'))
  }, [id])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre      = 'El nombre es obligatorio.'
    if (!form.categoriaId)   e.categoriaId = 'Seleccioná una categoría.'
    if (form.valor && isNaN(Number(form.valor))) e.valor = 'Ingresá un número válido.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setSaving(true)
    try {
      await InventarioService.update(id, {
        nombre:      form.nombre.trim(),
        categoriaId: form.categoriaId,
        marca:       form.marca.trim()       || null,
        modelo:      form.modelo.trim()      || null,
        numeroSerie: form.numeroSerie.trim() || null,
        descripcion: form.descripcion.trim() || null,
        añoCompra:   form.añoCompra          || null,
        valor:       form.valor ? Number(form.valor) : null,
        importante:  form.importante === true,
      })
      setGuardado(true)
      setTimeout(() => navigate(`/herramientas/${id}`), 1200)
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
        <p className={styles.exitoNombre}>Redirigiendo al detalle...</p>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate(`/herramientas/${id}`)}>← Volver</button>
        <div>
          <h1 className={styles.title}>Editar herramienta</h1>
          <p className={styles.subtitle}>El código QR no se modifica.</p>
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
              <label className={styles.label} htmlFor="categoriaId">Categoría <span className={styles.req}>*</span></label>
              <select id="categoriaId"
                className={`${styles.select} ${errores.categoriaId ? styles.inputError : ''}`}
                value={form.categoriaId} onChange={e => set('categoriaId', e.target.value)}>
                <option value="">Seleccioná una categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errores.categoriaId && <span className={styles.error}>{errores.categoriaId}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="numeroSerie">Número de serie</label>
              <input id="numeroSerie" type="text" className={styles.input}
                value={form.numeroSerie} onChange={e => set('numeroSerie', e.target.value)} />
            </div>

            {/* Importancia — herramienta con rastreador GPS */}
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Importancia</label>
              <div className={styles.importanteRow}>
                <button type="button"
                  className={`${styles.importanteBtn} ${!form.importante ? styles.importanteBtnActive : ''}`}
                  onClick={() => set('importante', false)}>
                  Normal
                </button>
                <button type="button"
                  className={`${styles.importanteBtn} ${form.importante ? styles.importanteBtnImportante : ''}`}
                  onClick={() => set('importante', true)}>
                  ⭐ Importante — lleva rastreador GPS
                </button>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Marca y modelo</legend>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="marca">Marca</label>
              <input id="marca" type="text" className={styles.input}
                value={form.marca} onChange={e => set('marca', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="modelo">Modelo</label>
              <input id="modelo" type="text" className={styles.input}
                value={form.modelo} onChange={e => set('modelo', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Datos de compra</legend>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="añoCompra">Año de compra</label>
              <select id="añoCompra" className={styles.select}
                value={form.añoCompra} onChange={e => set('añoCompra', e.target.value)}>
                <option value="">Sin especificar</option>
                {AÑOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="valor">
                Valor <span className={styles.optional}>(ARS)</span>
              </label>
              <input id="valor" type="number" min="0"
                className={`${styles.input} ${errores.valor ? styles.inputError : ''}`}
                value={form.valor} onChange={e => set('valor', e.target.value)} />
              {errores.valor && <span className={styles.error}>{errores.valor}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Descripción</legend>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="descripcion">Observaciones</label>
            <textarea id="descripcion" className={styles.textarea} rows={3}
              value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate(`/herramientas/${id}`)}>
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
