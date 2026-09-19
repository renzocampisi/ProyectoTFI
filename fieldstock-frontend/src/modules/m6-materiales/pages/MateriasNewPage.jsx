// src/modules/m6-materiales/pages/MateriasNewPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialesService } from '../services/materiales.service'
import DuplicateMaterialModal from '../components/DuplicateMaterialModal'
import { formatStockAbreviado } from '@shared/utils/unidades'
import useLockBodyScroll from '@shared/hooks/useLockBodyScroll'
import styles from './MateriasNewPage.module.css'

// Modales inline "agregar unidad/marca nueva" — separados del componente
// principal para poder llamar useLockBodyScroll() solo mientras están
// montados, sin violar reglas de hooks (el padre tiene returns condicionales).
function NuevaUnidadModal({ valor, onChange, onEnter, error, onCancel, onAgregar }) {
  useLockBodyScroll()
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Nueva unidad de medida</h3>
        <p className={styles.modalHelp}>
          Se guarda en este navegador y queda disponible para los próximos
          materiales que crees acá.
        </p>
        <input type="text" className={styles.input} autoFocus
          placeholder="Ej: bolsa, m², pieza..."
          value={valor}
          onChange={onChange}
          onKeyDown={onEnter} />
        {error && <span className={styles.error}>{error}</span>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.btnPrimary} onClick={onAgregar}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

function NuevaMarcaModal({ valor, onChange, onEnter, onCancel, onAgregar }) {
  useLockBodyScroll()
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Nueva marca</h3>
        <p className={styles.modalHelp}>
          Si querés que el logo se muestre en el detalle, el nombre tiene que
          coincidir con el archivo cargado en el catálogo de marcas.
        </p>
        <input type="text" className={styles.input} autoFocus
          placeholder="Ej: Tacsa, Roda, Precincor"
          value={valor}
          onChange={onChange}
          onKeyDown={onEnter} />
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.btnPrimary} onClick={onAgregar}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

// Unidades base que vienen con el sistema. Si el usuario crea unidades
// propias via el botón "+", se persisten en localStorage para tenerlas
// disponibles en el próximo material (Word #21).
const UNIDADES_BASE = ['unidad','kg','metro','litro','caja','rollo','juego','par']

const STORAGE_UNIDADES = 'fs-unidades-extra'

function loadUnidadesExtra() {
  try {
    const raw = localStorage.getItem(STORAGE_UNIDADES)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function saveUnidadesExtra(arr) {
  try { localStorage.setItem(STORAGE_UNIDADES, JSON.stringify(arr)) } catch { /* no-op */ }
}

// Word #12: el stock mínimo default es 5 (no 0) para que la alerta de
// "stock bajo" sirva desde el primer momento.
const STOCK_MINIMO_DEFAULT = 5

const INICIAL  = {
  nombre: '', descripcion: '', marca: '',
  unidad: 'unidad',
  stockActual: '',
  stockMinimo: String(STOCK_MINIMO_DEFAULT),
}

export default function MateriasNewPage() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(false)
  const [guardado,setGuardado]= useState(null)
  // Lista de marcas ya usadas para autocomplete del input (Word #17)
  const [marcasExistentes, setMarcasExistentes] = useState([])
  // Unidades custom agregadas por el usuario (Word #21) — persistidas en localStorage
  const [unidadesExtra, setUnidadesExtra] = useState(() => loadUnidadesExtra())
  // Estado del modal "agregar unidad nueva"
  const [showNuevaUnidad, setShowNuevaUnidad] = useState(false)
  const [nuevaUnidadValor, setNuevaUnidadValor] = useState('')
  // Estado del modal "agregar marca nueva" — mismo patrón que unidad nueva.
  // Antes la marca era texto libre con autocomplete (datalist), lo que
  // permitía tipeos distintos para la misma marca (mayúsculas, espacios) y
  // rompía el matching de MarcaLogo contra /marcas/<slug>.png (issue mobile
  // testing: logo no aparecía por mismatch de texto).
  const [showNuevaMarca, setShowNuevaMarca] = useState(false)
  const [nuevaMarcaValor, setNuevaMarcaValor] = useState('')
  // Word #B: si al intentar crear detectamos un duplicado, guardamos el
  // material existente acá y mostramos el modal preguntando si sumar stock.
  const [duplicado, setDuplicado] = useState(null)

  // Lista combinada (base + custom) para el select
  const todasLasUnidades = [...UNIDADES_BASE, ...unidadesExtra]

  // Marcas para el select: las ya usadas en el catálogo + la que esté
  // seleccionada en el form (por si viene de agregar una nueva recién).
  const todasLasMarcas = [...new Set([...marcasExistentes, form.marca].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))

  const handleAgregarMarca = () => {
    const nueva = nuevaMarcaValor.trim()
    if (!nueva) return
    set('marca', nueva)
    setNuevaMarcaValor('')
    setShowNuevaMarca(false)
  }

  const handleAgregarUnidad = () => {
    const nueva = nuevaUnidadValor.trim().toLowerCase()
    if (!nueva) return
    if (todasLasUnidades.includes(nueva)) {
      setErrores(e => ({ ...e, nuevaUnidad: 'Esa unidad ya está en la lista.' }))
      return
    }
    const next = [...unidadesExtra, nueva]
    setUnidadesExtra(next)
    saveUnidadesExtra(next)
    setForm(f => ({ ...f, unidad: nueva }))  // auto-selecciona la recién creada
    setNuevaUnidadValor('')
    setShowNuevaUnidad(false)
    setErrores(e => ({ ...e, nuevaUnidad: undefined }))
  }

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

    // Word #21: stock inicial OBLIGATORIO (no permitir vacío). Si el material
    // realmente no tiene stock todavía, el usuario debe poner 0 explícitamente.
    if (form.stockActual === '' || form.stockActual === null) {
      e.stockActual = 'El stock inicial es obligatorio. Si todavía no hay, ingresá 0.'
    } else if (isNaN(Number(form.stockActual)) || Number(form.stockActual) < 0) {
      e.stockActual = 'Ingresá un número válido (0 o mayor).'
    }

    if (form.stockMinimo !== '' && isNaN(Number(form.stockMinimo))) {
      e.stockMinimo = 'Ingresá un número válido.'
    }
    return e
  }

  // Crea el material asumiendo que ya validamos que no hay duplicado.
  // Extraída en función aparte para que el flow del modal de duplicado
  // pueda reutilizar el path "crear nuevo igualmente" si en el futuro
  // agregamos esa opción (hoy solo ofrecemos sumar o cancelar).
  const crearMaterial = async () => {
    const mat = await MaterialesService.create({
      nombre:      form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      marca:       form.marca.trim() || null,
      unidad:      form.unidad,
      stockActual: form.stockActual ? Number(form.stockActual) : 0,
      stockMinimo: form.stockMinimo ? Number(form.stockMinimo) : 0,
    })
    setGuardado(mat)
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErrores(e2); return }
    setLoading(true)
    setErrores({})
    try {
      // Word #B: antes de crear, chequear si ya existe un material con
      // mismo nombre + marca. Si existe, abrir modal preguntando si sumar
      // stock al existente en vez de duplicar.
      const existente = await MaterialesService.checkDuplicate({
        nombre: form.nombre.trim(),
        marca:  form.marca.trim() || undefined,
      })
      if (existente) {
        setDuplicado(existente)
        setLoading(false)
        return
      }
      await crearMaterial()
    } catch (err) {
      setErrores({ general: err.message })
    } finally { setLoading(false) }
  }

  // Confirmar el "sumar stock al existente" desde el modal de duplicado.
  // El backend hace el UPDATE atómico y devuelve el material con stock nuevo.
  const handleConfirmSumarStock = async () => {
    if (!duplicado) return
    const cantidad = Number(form.stockActual) || 0
    const matActualizado = await MaterialesService.agregarStock(duplicado.id, cantidad)
    setDuplicado(null)
    // Reusamos la pantalla de éxito mostrando el material con stock nuevo.
    setGuardado(matActualizado)
  }

  if (guardado) return (
    <div className={styles.exito}>
      <div className={styles.exitoCard}>
        <span className={styles.exitoIcon}>✓</span>
        <h2 className={styles.exitoTitle}>Material registrado</h2>
        <p className={styles.exitoNombre}>{guardado.nombre}</p>
        <p className={styles.exitoStock}>Stock inicial: {formatStockAbreviado(guardado.stock_actual, guardado.unidad)}</p>
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
              {/* Word #21: botón "+" al lado del select para agregar unidades */}
              <div className={styles.unidadRow}>
                <select id="unidad" className={styles.select}
                  value={form.unidad} onChange={e => set('unidad', e.target.value)}>
                  {todasLasUnidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button type="button" className={styles.btnIcon}
                  onClick={() => setShowNuevaUnidad(true)}
                  title="Agregar nueva unidad de medida">
                  +
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="marca">
                Marca <span className={styles.optional}>(opcional)</span>
              </label>
              <div className={styles.unidadRow}>
                <select id="marca" className={styles.select}
                  value={form.marca} onChange={e => set('marca', e.target.value)}>
                  <option value="">Sin marca</option>
                  {todasLasMarcas.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" className={styles.btnIcon}
                  onClick={() => setShowNuevaMarca(true)}
                  title="Agregar marca nueva">
                  +
                </button>
              </div>
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
              <label className={styles.label} htmlFor="stockActual">
                Stock inicial <span className={styles.req}>*</span>
              </label>
              <input id="stockActual" type="number" min="0" step="0.01"
                className={`${styles.input} ${errores.stockActual ? styles.inputError : ''}`}
                placeholder="Ej: 100 (o 0 si todavía no hay)"
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

      {/* Modal: agregar nueva unidad de medida (Word #21) */}
      {showNuevaUnidad && (
        <NuevaUnidadModal
          valor={nuevaUnidadValor}
          onChange={e => setNuevaUnidadValor(e.target.value)}
          onEnter={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarUnidad() } }}
          error={errores.nuevaUnidad}
          onCancel={() => { setShowNuevaUnidad(false); setNuevaUnidadValor(''); setErrores(e => ({ ...e, nuevaUnidad: undefined })) }}
          onAgregar={handleAgregarUnidad}
        />
      )}

      {/* Modal: agregar marca nueva */}
      {showNuevaMarca && (
        <NuevaMarcaModal
          valor={nuevaMarcaValor}
          onChange={e => setNuevaMarcaValor(e.target.value)}
          onEnter={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarMarca() } }}
          onCancel={() => { setShowNuevaMarca(false); setNuevaMarcaValor('') }}
          onAgregar={handleAgregarMarca}
        />
      )}

      {/* Modal de duplicado (Word #B) — aparece si checkDuplicate encontró
          un material existente con mismo nombre + marca. Le da al usuario
          la opción de sumar al existente o cancelar para diferenciar. */}
      {duplicado && (
        <DuplicateMaterialModal
          existente={duplicado}
          cantidadASumar={Number(form.stockActual) || 0}
          unidadNueva={form.unidad}
          onConfirm={handleConfirmSumarStock}
          onCancel={() => setDuplicado(null)} />
      )}
    </div>
  )
}
