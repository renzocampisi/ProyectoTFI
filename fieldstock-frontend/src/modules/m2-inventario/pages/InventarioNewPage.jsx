// src/modules/m2-inventario/pages/InventarioNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { InventarioService } from '../services/inventario.service'
import styles from './InventarioNewPage.module.css'

const AÑO_ACTUAL = new Date().getFullYear()
const AÑOS = Array.from({ length: 20 }, (_, i) => AÑO_ACTUAL - i)

const INICIAL = {
  nombre: '', categoriaId: '', marca: '', modelo: '',
  numeroSerie: '', descripcion: '', añoCompra: '', valor: '',
}

export default function InventarioNewPage() {
  const navigate = useNavigate()
  const [form,       setForm]       = useState(INICIAL)
  const [errores,    setErrores]    = useState({})
  const [guardado,   setGuardado]   = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    InventarioService.getCategorias().then(setCategorias).catch(() => {})
  }, [])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setLoading(true)
    try {
      const herramienta = await InventarioService.create({
        nombre:      form.nombre.trim(),
        categoriaId: form.categoriaId,
        marca:       form.marca.trim()       || null,
        modelo:      form.modelo.trim()      || null,
        numeroSerie: form.numeroSerie.trim() || null,
        descripcion: form.descripcion.trim() || null,
        añoCompra:   form.añoCompra          || null,
        valor:       form.valor ? Number(form.valor) : null,
      })
      setGuardado(herramienta)
    } catch (err) {
      setErrores({ general: err.message || 'Error al guardar. Verificá que el backend esté corriendo.' })
    } finally { setLoading(false) }
  }

  if (guardado) {
    return (
      <div className={styles.exito}>
        <div className={styles.exitoCard}>
          <span className={styles.exitoIcon}>✓</span>
          <h2 className={styles.exitoTitle}>Herramienta registrada</h2>
          <p className={styles.exitoNombre}>{guardado.nombre}</p>
          <div className={styles.qrBox}>
            <p className={styles.qrLabel}>Código QR generado</p>
            <p className={styles.qrCodigo}>{guardado.codigo_qr}</p>
            <p className={styles.qrHint}>Este código se vincula permanentemente a la herramienta.</p>
          </div>
          <div className={styles.exitoActions}>
            <button className={styles.btnPrimary} onClick={() => navigate('/herramientas')}>
              Volver a herramientas
            </button>
            <button className={styles.btnGhost} onClick={() => { setForm(INICIAL); setGuardado(null) }}>
              Registrar otra
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/herramientas')}>← Volver</button>
        <div>
          <h1 className={styles.title}>Registrar herramienta</h1>
          <p className={styles.subtitle}>El código QR se genera automáticamente al guardar.</p>
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
                placeholder="Ej: Taladro percutor Bosch GSB 21-2 RE"
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
                placeholder="Ej: SN-2024-00123"
                value={form.numeroSerie} onChange={e => set('numeroSerie', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Marca y modelo</legend>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="marca">Marca</label>
              <input id="marca" type="text" className={styles.input}
                placeholder="Ej: Bosch, Makita, DeWalt"
                value={form.marca} onChange={e => set('marca', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="modelo">Modelo</label>
              <input id="modelo" type="text" className={styles.input}
                placeholder="Ej: GSB 21-2 RE"
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
                Valor de compra <span className={styles.optional}>(ARS)</span>
              </label>
              <input id="valor" type="number" min="0"
                className={`${styles.input} ${errores.valor ? styles.inputError : ''}`}
                placeholder="Ej: 150000"
                value={form.valor} onChange={e => set('valor', e.target.value)} />
              {errores.valor && <span className={styles.error}>{errores.valor}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Descripción</legend>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="descripcion">
              Observaciones <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea id="descripcion" className={styles.textarea} rows={3}
              placeholder="Características especiales, accesorios incluidos, estado al ingreso..."
              value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/herramientas')}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar y generar QR'}
          </button>
        </div>

      </form>
    </div>
  )
}
