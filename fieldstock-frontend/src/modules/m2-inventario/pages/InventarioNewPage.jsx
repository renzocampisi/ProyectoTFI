// src/modules/m2-inventario/pages/InventarioNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { InventarioService } from '../services/inventario.service'
import { api } from '@shared/utils/api'
import styles from './InventarioNewPage.module.css'

const DIVISAS = [
  { value: 'ARS', label: '$ ARS' },
  { value: 'USD', label: 'U$D'   },
  { value: 'EUR', label: '€ EUR' },
]

const ESTADOS_INICIALES = [
  { value: 'DISPONIBLE',       label: 'Disponible'       },
  { value: 'EN_MANTENIMIENTO', label: 'En mantenimiento' },
]

function SelectorConAgregar({ label, items, value, onChange, placeholder, onCrear, creando, req }) {
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevo,     setNuevo]     = useState('')
  const [error,     setError]     = useState(null)
  const [saving,    setSaving]    = useState(false)

  const handleCrear = async () => {
    if (!nuevo.trim()) { setError('Escribí un nombre'); return }
    setSaving(true); setError(null)
    try {
      const creado = await onCrear(nuevo.trim())
      onChange(creado.id || creado.nombre)
      setNuevo('')
      setShowNuevo(false)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label} {req && <span className={styles.req}>*</span>}</label>
      <div className={styles.categoriaRow}>
        <select className={styles.input} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— {placeholder} —</option>
          {items.map(i => <option key={i.id || i.nombre} value={i.id || i.nombre}>{i.nombre}</option>)}
        </select>
        <button type="button" className={styles.btnNuevaCat}
          onClick={() => setShowNuevo(v => !v)} title={`Nueva ${label.toLowerCase()}`}>+</button>
      </div>
      {showNuevo && (
        <div className={styles.nuevaCatBox}>
          <input type="text" className={styles.input}
            placeholder={`Nombre de la nueva ${label.toLowerCase()}`}
            value={nuevo}
            onChange={e => { setNuevo(e.target.value); setError(null) }}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCrear())} />
          {error && <span className={styles.error}>{error}</span>}
          <div className={styles.nuevaCatActions}>
            <button type="button" className={styles.btnGhost}
              onClick={() => { setShowNuevo(false); setNuevo(''); setError(null) }}>Cancelar</button>
            <button type="button" className={styles.btnPrimary}
              onClick={handleCrear} disabled={saving || creando}>
              {saving ? 'Guardando...' : `Crear ${label.toLowerCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventarioNewPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre:        '',
    categoriaId:   '',
    marcaNombre:   '',
    modelo:        '',
    numeroSerie:   '',
    anioCompra:    '',
    valor:         '',
    divisa:        'ARS',
    descripcion:   '',
    estadoInicial: 'DISPONIBLE',
    importante:    false,
  })
  const [errores,    setErrores]    = useState({})
  const [loading,    setLoading]    = useState(false)
  const [guardado,   setGuardado]   = useState(null)
  const [categorias, setCategorias] = useState([])
  const [marcas,     setMarcas]     = useState([])

  useEffect(() => {
    api.get('/api/categorias').then(data => setCategorias(data)).catch(() => {})
    api.get('/api/marcas').then(data => setMarcas(data)).catch(() => {})
  }, [])

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: undefined }))
  }

  const handleCrearCategoria = async (nombre) => {
    const cat = await api.post('/api/categorias', { nombre })
    setCategorias(prev => [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return cat
  }

  const handleCrearMarca = async (nombre) => {
    const marca = await api.post('/api/marcas', { nombre })
    setMarcas(prev => [...prev, marca].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return { id: marca.nombre, nombre: marca.nombre }
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre      = 'El nombre es obligatorio.'
    if (!form.categoriaId)   e.categoriaId = 'Seleccioná una categoría.'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setLoading(true)
    try {
      const herramienta = await InventarioService.create({
        nombre:        form.nombre.trim(),
        categoriaId:   form.categoriaId,
        marca:         form.marcaNombre  || null,
        modelo:        form.modelo       || null,
        numeroSerie:   form.numeroSerie  || null,
        anioCompra:    form.anioCompra   || null,
        valor:         form.valor        ? Number(form.valor) : null,
        divisa:        form.divisa,
        descripcion:   form.descripcion  || null,
        estadoInicial: form.estadoInicial,
        importante:    form.importante,
      })
      setGuardado(herramienta)
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setLoading(false) }
  }

  const resetForm = () => {
    setForm({ nombre:'',categoriaId:'',marcaNombre:'',modelo:'',numeroSerie:'',
      anioCompra:'',valor:'',divisa:'ARS',descripcion:'',estadoInicial:'DISPONIBLE',importante:false })
    setGuardado(null)
  }

  if (guardado) return (
    <div className={styles.exito}>
      <div className={styles.exitoCard}>
        <span className={styles.exitoIcon}>✓</span>
        <h2 className={styles.exitoTitle}>Herramienta registrada</h2>
        <p className={styles.exitoNombre}>{guardado.nombre}</p>
        <p className={styles.exitoCodigo}>{guardado.codigo_qr}</p>
        <div className={styles.exitoActions}>
          <button className={styles.btnPrimary} onClick={() => navigate(`/herramientas/${guardado.id}`)}>
            Ver herramienta
          </button>
          <button className={styles.btnGhost} onClick={resetForm}>Registrar otra</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/herramientas')}>← Volver</button>
        <div>
          <h1 className={styles.title}>Registrar herramienta</h1>
          <p className={styles.subtitle}>El código QR se genera automáticamente.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        {/* Identificación */}
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Identificación</legend>
          <div className={styles.grid2}>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Nombre <span className={styles.req}>*</span></label>
              <input type="text" className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
                placeholder="Ej: Taladro percutor inalámbrico"
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              {errores.nombre && <span className={styles.error}>{errores.nombre}</span>}
            </div>

            {/* Categoría */}
            <SelectorConAgregar
              label="Categoría" req
              items={categorias}
              value={form.categoriaId}
              onChange={v => set('categoriaId', v)}
              placeholder="Seleccioná"
              onCrear={handleCrearCategoria}
            />
            {errores.categoriaId && <span className={styles.error}>{errores.categoriaId}</span>}

            {/* Marca */}
            <SelectorConAgregar
              label="Marca"
              items={marcas.map(m => ({ id: m.nombre, nombre: m.nombre }))}
              value={form.marcaNombre}
              onChange={v => set('marcaNombre', v)}
              placeholder="Seleccioná o agregá"
              onCrear={handleCrearMarca}
            />

            <div className={styles.field}>
              <label className={styles.label}>Estado inicial</label>
              <select className={styles.input} value={form.estadoInicial}
                onChange={e => set('estadoInicial', e.target.value)}>
                {ESTADOS_INICIALES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Modelo</label>
              <input type="text" className={styles.input} placeholder="Ej: DCD791D2"
                value={form.modelo} onChange={e => set('modelo', e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Número de serie</label>
              <input type="text" className={styles.input} placeholder="Ej: SN-123456"
                value={form.numeroSerie} onChange={e => set('numeroSerie', e.target.value)} />
            </div>

            {/* Importancia */}
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

        {/* Compra */}
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Datos de compra</legend>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Año de compra</label>
              <input type="number" className={styles.input}
                placeholder={new Date().getFullYear()} min="1990" max={new Date().getFullYear()}
                value={form.anioCompra} onChange={e => set('anioCompra', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Valor de compra</label>
              <div className={styles.valorRow}>
                <select className={styles.divisaSelect} value={form.divisa}
                  onChange={e => set('divisa', e.target.value)}>
                  {DIVISAS.map(d => <option key={d.value} value={d.value}>{d.value}</option>)}
                </select>
                <input type="number" className={styles.input}
                  placeholder="0.00" min="0" step="0.01"
                  value={form.valor} onChange={e => set('valor', e.target.value)} />
              </div>
            </div>
          </div>
        </fieldset>

        {/* Observaciones */}
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>Observaciones <span className={styles.optional}>(opcional)</span></legend>
          <textarea className={`${styles.input} ${styles.textarea}`}
            placeholder="Notas adicionales..." rows={3}
            value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </fieldset>

        {errores.general && <div className={styles.errorBanner}>⚠ {errores.general}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/herramientas')}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar herramienta'}
          </button>
        </div>
      </form>
    </div>
  )
}
