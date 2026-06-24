// src/modules/m5-remito/pages/RemitosDetailPage.jsx
import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useRemito } from '../hooks/useRemitos'
import { RemitosService } from '../services/remitos.service'
import { InventarioService } from '@modules/m2-inventario/services/inventario.service'
import { MaterialesService } from '@modules/m6-materiales/services/materiales.service'
import { useAuth } from '@shared/hooks/useAuth'
import { ROLES, esDueño as esDueñoOAdmin } from '@shared/constants/roles'
import EstadoRemitoBadge from '../components/EstadoRemitoBadge'
import RemitoEditModal from './RemitoEditModal'
import RemitoPrint from './RemitoPrint'
import { nombreRemito } from '../utils/remito-format'
import styles from './RemitosDetailPage.module.css'

const PASOS = [
  { key: 'BORRADOR',            label: 'Borrador'    },
  { key: 'CONFIRMADO',          label: 'Confirmado'  },
  { key: 'EN_TRANSITO',         label: 'En tránsito' },
  { key: 'EN_OBRA',             label: 'En obra'     },
  { key: 'EN_RETORNO',          label: 'En retorno'  },
  { key: 'EN_TRANSITO_RETORNO', label: 'Volviendo'   },
  { key: 'CERRADO',             label: 'Cerrado'     },
]

const LABEL_AVANZAR = {
  BORRADOR:            'Confirmar egreso',
  CONFIRMADO:          'Marcar en tránsito',
  EN_TRANSITO:         'Confirmar llegada a obra',
  EN_OBRA:             'Iniciar retorno',
  EN_RETORNO:          'Confirmar salida desde obra',
  EN_TRANSITO_RETORNO: 'Confirmar llegada al depósito',
}

const ESTADOS_RETORNO_HERR = [
  { value: 'VUELVE',        label: '✓ Vuelve',        cls: 'vuelve'    },
  { value: 'QUEDA_EN_OBRA', label: '⏳ Queda en obra', cls: 'quedaObra' },
  { value: 'ROTA',          label: '⚠ Rota',           cls: 'rota'      },
  { value: 'PERDIDA',       label: '✕ Perdida',        cls: 'perdida'   },
]

// Mapeo estado_retorno (DB) → clase CSS para el pill de visualización.
// Se usa en remitos cerrados/en_transito_retorno para que el badge tenga
// el color del estado (verde=vuelve, violeta=queda_en_obra, naranja=rota,
// rojo=perdida).
const ESTADO_RETORNO_CLS = {
  VUELVE:        'vuelve',
  QUEDA_EN_OBRA: 'quedaObra',
  ROTA:          'rota',
  PERDIDA:       'perdida',
}

const UNIDADES = ['unidad','kg','metro','litro','caja','rollo','juego','par']

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// Formato monetario para mostrar valores de herramientas en el bloque
// "Herramientas extraviadas". Si no hay divisa, asume ARS.
function formatMoneda(valor, divisa) {
  const num = Number(valor)
  if (!Number.isFinite(num) || num <= 0) return '— sin valor cargado'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: divisa || 'ARS',
    maximumFractionDigits: 0,
  }).format(num)
}

// Bloque de resumen de extravíos para remitos CERRADO/EN_TRANSITO_RETORNO.
// Cuenta items con extraviado=true o estado_retorno='PERDIDA', suma su
// herramienta_valor y muestra detalle. Si no hay extravíos, no se renderiza.
function ExtraviosBlock({ items }) {
  const extraviados = (items || []).filter(i =>
    i.extraviado === true || i.estado_retorno === 'PERDIDA'
  )
  if (!extraviados.length) return null

  // Asumimos que todas las herramientas comparten divisa (default ARS).
  // Si hubiera mezcla, mostramos la divisa de la primera con valor cargado.
  const divisaRef = extraviados.find(i => i.herramienta_valor > 0)?.herramienta_divisa || 'ARS'
  const totalSinValor = extraviados.filter(i => !(Number(i.herramienta_valor) > 0)).length
  const totalEstimado = extraviados.reduce((sum, i) => sum + (Number(i.herramienta_valor) || 0), 0)

  return (
    <div className={styles.extraviosBlock}>
      <div className={styles.extraviosHeader}>
        <span className={styles.extraviosTitulo}>
          ✕ Herramientas extraviadas
          <span className={styles.extraviosCount}>{extraviados.length}</span>
        </span>
        <span className={styles.extraviosTotal}>
          Total estimado: <strong>{formatMoneda(totalEstimado, divisaRef)}</strong>
        </span>
      </div>
      <ul className={styles.extraviosLista}>
        {extraviados.map(it => (
          <li key={it.id} className={styles.extraviosItem}>
            <span className={styles.extraviosNombre}>
              {it.herramienta_nombre}
              {it.herramienta_qr && <span className={styles.extraviosQr}> · {it.herramienta_qr}</span>}
            </span>
            <span className={styles.extraviosValor}>
              {formatMoneda(it.herramienta_valor, it.herramienta_divisa)}
            </span>
          </li>
        ))}
      </ul>
      {totalSinValor > 0 && (
        <p className={styles.extraviosNota}>
          {totalSinValor} herramienta{totalSinValor !== 1 ? 's' : ''} sin valor cargado en su ficha — el total no las incluye.
        </p>
      )}
    </div>
  )
}

function imprimirRemito(remito) {
  const el = document.getElementById('remito-print')
  if (!el) return
  const fecha  = remito?.fecha_egreso
    ? remito.fecha_egreso.split('T')[0].split('-').reverse().join('.')
    : new Date().toLocaleDateString('es-AR').replace(/\//g, '.')
  const numero = remito?.numero?.replace(/-/g, '_') || 'sin_numero'
  const titulo = `remito_${numero}_${fecha}`
  const ventana = window.open('', '_blank', 'width=900,height=700')
  ventana.document.write(`
    <html>
      <head>
        <title>${titulo}</title>
        <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Arial, sans-serif; background: white; } @page { size: A4; margin: 15mm; }</style>
      </head>
      <body>${el.innerHTML}</body>
      <${'script'}>window.onload = () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 1000) }, 300) }</${'script'}>
    </html>
  `)
  ventana.document.close()
}

// ── Modal multi-select herramientas ──────────────────────────
function HerrBuscadorModal({ remitoId, idsYa, onClose, onSaved }) {
  const [herramientas, setHerramientas] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [busqueda,     setBusqueda]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  // Guard síncrono contra doble-click (issue #9). useState es asíncrono y
  // se cuela un 2° click antes de que React renderice disabled={saving}.
  const savingRef = useRef(false)

  // Cargar herramientas disponibles al montar el modal.
  // Antes esto estaba con `useState(() => {...}, [])` que es semánticamente
  // incorrecto (useState ignora deps y el callback es para initial state,
  // no para side effects). Funcionaba "de casualidad" porque el callback
  // se ejecuta una sola vez igual, pero rompía cualquier lint estricto.
  useEffect(() => {
    InventarioService.getAll({ estado: 'DISPONIBLE' })
      .then(data => setHerramientas(data.filter(h => !idsYa.includes(h.id))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtradas = useMemo(() =>
    herramientas.filter(h =>
      h.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      h.codigo_qr?.toLowerCase().includes(busqueda.toLowerCase())
    ), [herramientas, busqueda])

  const toggleAll = () => {
    if (seleccionadas.size === filtradas.length) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(filtradas.map(h => h.id)))
    }
  }

  const toggle = (id) => {
    const next = new Set(seleccionadas)
    next.has(id) ? next.delete(id) : next.add(id)
    setSeleccionadas(next)
  }

  const handleAgregar = async () => {
    if (!seleccionadas.size) return
    if (savingRef.current) return  // bloqueo síncrono contra doble-click
    savingRef.current = true
    setSaving(true); setError(null)
    try {
      // Agregar todas en paralelo
      await Promise.all(
        [...seleccionadas].map(herramientaId =>
          RemitosService.addItem(remitoId, { herramientaId, estadoSalida: 'BUENO' })
        )
      )
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); savingRef.current = false }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalGrande}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Agregar herramientas</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        {/* Búsqueda */}
        <div className={styles.modalSearch}>
          <input type="search" className={styles.input}
            placeholder="Buscar por nombre o código QR..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus />
        </div>

        {error && <p className={styles.modalError}>⚠ {error}</p>}

        {loading ? (
          <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando...</div>
        ) : filtradas.length === 0 ? (
          <p className={styles.buscadorEmpty}>
            {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay herramientas disponibles.'}
          </p>
        ) : (
          <>
            {/* Seleccionar todas */}
            <div className={styles.selectAllRow}>
              <label className={styles.checkRow}>
                <input type="checkbox"
                  checked={seleccionadas.size === filtradas.length && filtradas.length > 0}
                  onChange={toggleAll} />
                <span className={styles.checkLabel}>
                  {seleccionadas.size === filtradas.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  <span className={styles.checkCount}>({filtradas.length})</span>
                </span>
              </label>
            </div>

            {/* Lista */}
            <ul className={styles.checkLista}>
              {filtradas.map(h => (
                <li key={h.id}
                  className={`${styles.checkItem} ${seleccionadas.has(h.id) ? styles.checkItemSelected : ''}`}
                  onClick={() => toggle(h.id)}>
                  <input type="checkbox" checked={seleccionadas.has(h.id)} onChange={() => toggle(h.id)}
                    onClick={e => e.stopPropagation()} />
                  <div className={styles.checkInfo}>
                    <span className={styles.checkNombre}>{h.nombre}</span>
                    <span className={styles.checkSub}>
                      {h.codigo_qr}
                      {h.marca && ` · ${h.marca}`}
                      {h.importante && ' · ⭐'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Footer */}
        <div className={styles.modalFooter}>
          <span className={styles.seleccionadosCount}>
            {seleccionadas.size > 0
              ? `${seleccionadas.size} herramienta${seleccionadas.size !== 1 ? 's' : ''} seleccionada${seleccionadas.size !== 1 ? 's' : ''}`
              : 'Ninguna seleccionada'}
          </span>
          <div className={styles.modalActions}>
            <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
            <button className={styles.btnPrimary}
              onClick={handleAgregar}
              disabled={saving || seleccionadas.size === 0}>
              {saving ? 'Agregando...' : `Agregar ${seleccionadas.size > 0 ? seleccionadas.size : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal multi-select materiales ─────────────────────────────
function MatBuscadorModal({ remitoId, idsYa, onClose, onSaved }) {
  const [materiales,   setMateriales]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modo,         setModo]         = useState('catalogo')
  const [busqueda,     setBusqueda]     = useState('')
  const [cantidades,   setCantidades]   = useState({}) // { materialId: cantidad }
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [matLibre,     setMatLibre]     = useState({ descripcion: '', cantidad: '', unidad: 'unidad' })
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  // Guard síncrono contra doble-click (issue #9). El disabled={saving} llega
  // tarde al DOM (un re-render después), un doble-click rápido lo evade y
  // genera duplicados en remito_materiales. Este ref bloquea sincrónicamente.
  const savingRef = useRef(false)

  // Cargar materiales del catálogo con stock disponible (mismo fix que
  // HerrBuscadorModal: useState→useEffect, ver comentario arriba).
  useEffect(() => {
    MaterialesService.getAll()
      .then(data => setMateriales(data.filter(m => m.stock_actual > 0 && !idsYa.includes(m.id))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() =>
    materiales.filter(m =>
      m.nombre.toLowerCase().includes(busqueda.toLowerCase())
    ), [materiales, busqueda])

  const toggleMat = (id) => {
    const next = new Set(seleccionados)
    next.has(id) ? next.delete(id) : next.add(id)
    setSeleccionados(next)
    if (!cantidades[id]) setCantidades(c => ({ ...c, [id]: '' }))
  }

  const setCantidad = (id, val) => {
    setCantidades(c => ({ ...c, [id]: val }))
  }

  // ── Validación cliente-side de stock (issue #10) ──
  // Map por id → material para consultas rápidas en O(1).
  const matsById = useMemo(
    () => materiales.reduce((acc, m) => ({ ...acc, [m.id]: m }), {}),
    [materiales]
  )

  // Para un material seleccionado, indica si la cantidad ingresada supera
  // el stock disponible. Vacío o no-numérico cuenta como "sin error" para
  // no marcar rojo apenas hace foco — solo invalida cuando hay un número
  // mayor al stock.
  const excedeStock = (id) => {
    const m    = matsById[id]
    const cant = Number(cantidades[id])
    return m && cant > 0 && cant > m.stock_actual
  }

  const haySeleccionadosInvalidos = [...seleccionados].some(excedeStock)

  const handleAgregar = async () => {
    // Validar que todos los seleccionados tengan cantidad
    const sinCantidad = [...seleccionados].filter(id => !cantidades[id] || Number(cantidades[id]) <= 0)
    if (sinCantidad.length) { setError('Ingresá la cantidad de cada material seleccionado.'); return }

    // Validación cliente-side de stock antes de mandar (issue #10)
    if (haySeleccionadosInvalidos) {
      setError('Hay materiales con cantidad mayor al stock disponible. Corregilos antes de agregar.')
      return
    }

    if (savingRef.current) return  // guard síncrono (issue #9)
    savingRef.current = true
    setSaving(true); setError(null)
    try {
      await Promise.all(
        [...seleccionados].map(id =>
          RemitosService.addMaterial(remitoId, {
            materialId: id,
            cantidad:   Number(cantidades[id]),
            unidad:     matsById[id].unidad,
          })
        )
      )
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); savingRef.current = false }
  }

  const handleAddLibre = async () => {
    if (!matLibre.descripcion.trim() || !matLibre.cantidad || Number(matLibre.cantidad) <= 0) {
      setError('Completá descripción y cantidad'); return
    }
    if (savingRef.current) return  // guard síncrono (issue #9)
    savingRef.current = true
    setSaving(true); setError(null)
    try {
      await RemitosService.addMaterial(remitoId, {
        descripcionLibre: matLibre.descripcion.trim(),
        cantidad: Number(matLibre.cantidad),
        unidad: matLibre.unidad,
      })
      setMatLibre({ descripcion: '', cantidad: '', unidad: 'unidad' })
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); savingRef.current = false }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalGrande}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Agregar materiales</h3>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.modoTabs}>
          <button className={`${styles.modoTab} ${modo === 'catalogo' ? styles.modoTabActive : ''}`}
            onClick={() => setModo('catalogo')}>Del catálogo</button>
          <button className={`${styles.modoTab} ${modo === 'libre' ? styles.modoTabActive : ''}`}
            onClick={() => setModo('libre')}>Descripción libre</button>
        </div>

        {error && <p className={styles.modalError}>⚠ {error}</p>}

        {modo === 'catalogo' ? (
          <>
            <div className={styles.modalSearch}>
              <input type="search" className={styles.input}
                placeholder="Buscar material..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus />
            </div>

            {loading ? (
              <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando...</div>
            ) : filtrados.length === 0 ? (
              <p className={styles.buscadorEmpty}>
                {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay materiales con stock disponible.'}
              </p>
            ) : (
              <ul className={styles.checkLista}>
                {filtrados.map(m => {
                  const excede = excedeStock(m.id)
                  return (
                    <li key={m.id}
                      className={`${styles.checkItem} ${seleccionados.has(m.id) ? styles.checkItemSelected : ''}`}>
                      <input type="checkbox" checked={seleccionados.has(m.id)}
                        onChange={() => toggleMat(m.id)} />
                      <div className={styles.checkInfo} onClick={() => toggleMat(m.id)}>
                        <span className={styles.checkNombre}>{m.nombre}</span>
                        <span className={styles.checkSub}>Stock: {m.stock_actual} {m.unidad}</span>
                      </div>
                      {seleccionados.has(m.id) && (
                        <div className={styles.cantidadWrapper}>
                          <input
                            type="number" min="1" step="1" max={m.stock_actual}
                            // Borde rojo cuando excede el stock (issue #10)
                            className={`${styles.cantidadInputInline} ${excede ? styles.inputError : ''}`}
                            placeholder={`Máx ${m.stock_actual}`}
                            value={cantidades[m.id] || ''}
                            onChange={e => setCantidad(m.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            aria-invalid={excede}
                            autoFocus
                          />
                          {excede && (
                            <span className={styles.cantidadErrorInline}>
                              Excede stock disponible ({m.stock_actual})
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <div className={styles.modalFooter}>
              <span className={styles.seleccionadosCount}>
                {seleccionados.size > 0
                  ? `${seleccionados.size} material${seleccionados.size !== 1 ? 'es' : ''} seleccionado${seleccionados.size !== 1 ? 's' : ''}`
                  : 'Ninguno seleccionado'}
                {haySeleccionadosInvalidos && (
                  <span className={styles.cantidadErrorInline}> · revisá cantidades en rojo</span>
                )}
              </span>
              <div className={styles.modalActions}>
                <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
                <button className={styles.btnPrimary}
                  onClick={handleAgregar}
                  // Bloqueado si: ya está guardando, no hay seleccionados,
                  // o alguno excede su stock (issue #10)
                  disabled={saving || seleccionados.size === 0 || haySeleccionadosInvalidos}>
                  {saving ? 'Agregando...' : `Agregar ${seleccionados.size > 0 ? seleccionados.size : ''}`}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.libreForm}>
            <input type="text" className={styles.input}
              placeholder="Descripción del material o insumo"
              value={matLibre.descripcion}
              onChange={e => setMatLibre(f => ({ ...f, descripcion: e.target.value }))} />
            <div className={styles.libreRow}>
              <input type="number" min="0" step="1" className={styles.input}
                placeholder="Cantidad"
                value={matLibre.cantidad}
                onChange={e => setMatLibre(f => ({ ...f, cantidad: e.target.value }))} />
              <select className={styles.select} value={matLibre.unidad}
                onChange={e => setMatLibre(f => ({ ...f, unidad: e.target.value }))}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleAddLibre} disabled={saving}>
                {saving ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Detecta si el viewport actual está en modo mobile (<= 768px).
// Usado en la sección "Acción" para decidir si mostrar el QR inline
// (PC: el usuario lo escanea con el celular del responsable) o un botón
// directo a la página mobile del remito (celular: ya estás en mobile,
// no tiene sentido escanear tu propia pantalla).
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches
      : false
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return isMobile
}

// ── Página principal ──────────────────────────────────────────
export default function RemitosDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { remito, loading, error, refetch } = useRemito(id)
  // Solo el DUEÑO (o ADMIN) puede avanzar/volver-a-borrador desde la web.
  // Encargado y Operario tienen que usar el QR mobile. El backend también
  // lo enforce con requireRole — esto es solo para que la UI no muestre
  // botones que van a fallar y para mostrar un mensaje aclaratorio.
  const { role } = useAuth()
  const esDueño = esDueñoOAdmin(role)
  const isMobile = useIsMobile()

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)
  const [showEdit,      setShowEdit]      = useState(false)
  const [confirmVolver, setConfirmVolver] = useState(false)
  const [showHerrModal, setShowHerrModal] = useState(false)
  const [showMatModal,  setShowMatModal]  = useState(false)

  // ── Optimistic UI para marcas de retorno (issue #4) ──
  // Cada marca de retorno antes hacía un refetch del remito completo, lo
  // que se sentía como un "refresh" de la página. Ahora guardamos el
  // override local, lo mostramos al instante y persistimos en background
  // sin refetch. El próximo refetch lo dispara handleAvanzar al final.
  const [retornosLocales,    setRetornosLocales]    = useState({})  // { itemId: estado_retorno }
  const [cantidadesLocales,  setCantidadesLocales]  = useState({})  // { matItemId: cantidad_retorno }
  const [extraviadosLocales, setExtraviadosLocales] = useState({})  // { matItemId: bool }  — override optimistic del flag
  const [modoLocales,        setModoLocales]        = useState({})  // { matItemId: 'TODOS'|'PARCIAL'|'NINGUNO' } — solo cuando el user clickeó pero aún no commiteó (caso "Parcial" sin escribir todavía)

  // (El useEffect del auto-close del modal QR se removió junto con el
  // botón QR del header. Ahora el QR vive inline en la card "Acción"
  // del sidebar y se re-renderiza naturalmente con cada refetch del
  // remito — no hace falta lógica de cierre.)

  // action() se usa para operaciones que SÍ necesitan refetch
  // (avanzar estado, volver a borrador, agregar/quitar items).
  const action = async (fn) => {
    setLoadingAction(true); setErrAction(null)
    try { await fn(); await refetch() }
    catch (err) { setErrAction(err.message) }
    finally { setLoadingAction(false) }
  }

  const handleAvanzar = () => action(() => RemitosService.avanzar(id))
  const handleVolverBorrador = () => action(async () => {
    await RemitosService.volverABorrador(id)
    setConfirmVolver(false)
  })
  const handleRemoveHerramienta = (itemId) => action(() => RemitosService.removeItem(id, itemId))
  const handleRemoveMaterial = (matItemId) => action(() => RemitosService.removeMaterial(id, matItemId))

  // Optimistic: aplicar override local + persist en background sin refetch.
  // Si la PATCH falla, revertir el override y mostrar el error.
  const handleRetornoHerramienta = async (itemId, estadoRetorno) => {
    const prev = retornosLocales[itemId]
    setRetornosLocales(o => ({ ...o, [itemId]: estadoRetorno }))
    setErrAction(null)
    try {
      await RemitosService.updateItemRetorno(id, itemId, { estadoRetorno })
    } catch (err) {
      // Revertir el optimistic update si falló la persistencia
      setRetornosLocales(o => ({ ...o, [itemId]: prev }))
      setErrAction(err.message)
    }
  }

  // Persiste el retorno parcial/total/ninguno con optimistic update.
  // body: { cantidadRetorno: number, extraviado?: bool }
  const handleRetornoMaterial = async (matItemId, body) => {
    const valor = Number(body.cantidadRetorno)
    const prevCantidad   = cantidadesLocales[matItemId]
    const prevExtraviado = extraviadosLocales[matItemId]
    setCantidadesLocales(o => ({ ...o, [matItemId]: valor }))
    if (body.extraviado !== undefined) {
      setExtraviadosLocales(o => ({ ...o, [matItemId]: body.extraviado }))
    }
    setErrAction(null)
    try {
      await RemitosService.updateMaterialRetorno(id, matItemId, {
        cantidadRetorno: valor,
        ...(body.extraviado !== undefined ? { extraviado: body.extraviado } : {}),
      })
    } catch (err) {
      // Revertir ambos overrides si falló la persistencia
      setCantidadesLocales(o => ({ ...o, [matItemId]: prevCantidad }))
      if (body.extraviado !== undefined) {
        setExtraviadosLocales(o => ({ ...o, [matItemId]: prevExtraviado }))
      }
      setErrAction(err.message)
    }
  }

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando remito...</div>
  )
  if (error || !remito) return (
    <div className={styles.noEncontrado}>
      <span>🔍</span><h2>{error || 'Remito no encontrado'}</h2>
      <button className={styles.btnGhost} onClick={() => navigate('/remitos')}>← Volver</button>
    </div>
  )

  const pasoActual   = PASOS.findIndex(p => p.key === remito.estado)
  const esBorrador   = remito.estado === 'BORRADOR'
  const esConfirmado = remito.estado === 'CONFIRMADO'
  const esEnObra     = remito.estado === 'EN_OBRA'
  const esRetorno    = remito.estado === 'EN_RETORNO'
  // Matriz de permisos por estado (espejo de ROLES_POR_ESTADO_AVANCE del backend):
  //   - BORRADOR: cualquier rol autorizado puede confirmar el remito que cargó.
  //   - EN_OBRA: ENCARGADO de obra o DUEÑO/ADMIN inicia el retorno
  //     (OPERARIO NO — asiste pero no decide).
  //   - Resto de estados: solo DUEÑO/ADMIN por web (los demás van por QR).
  const puedeEnObra   = esEnObra && (esDueño || role === ROLES.ENCARGADO)
  const puedeAvanzar  = remito.estado !== 'CERRADO' && (esBorrador || puedeEnObra || esDueño)

  const idsHerrYa = remito.items?.map(i => i.herramienta_id) ?? []
  const idsMatsYa = remito.materiales?.map(m => m.material_id).filter(Boolean) ?? []

  return (
    <div className={styles.page}>

      <RemitoPrint remito={remito} />

      {showEdit && (
        <RemitoEditModal remito={remito}
          onClose={() => setShowEdit(false)}
          onSaved={async () => { setShowEdit(false); await refetch() }} />
      )}

      {showHerrModal && (
        <HerrBuscadorModal
          remitoId={id}
          idsYa={idsHerrYa}
          onClose={() => setShowHerrModal(false)}
          onSaved={async () => { setShowHerrModal(false); await refetch() }}
        />
      )}

      {showMatModal && (
        <MatBuscadorModal
          remitoId={id}
          idsYa={idsMatsYa}
          onClose={() => setShowMatModal(false)}
          onSaved={async () => { setShowMatModal(false); await refetch() }}
        />
      )}

      {confirmVolver && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalConfirm}>
            <h3 className={styles.modalTitle}>¿Volver a Borrador?</h3>
            <p className={styles.modalText}>
              Las herramientas volverán a <strong>DISPONIBLE</strong> y el stock de materiales se repondrá. Los ítems seguirán en el remito.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmVolver(false)}>Cancelar</button>
              <button className={styles.btnConfirmarVolver} onClick={handleVolverBorrador} disabled={loadingAction}>
                {loadingAction ? 'Procesando...' : '↩ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/remitos')}>← Volver</button>
        <div className={styles.headerMain}>
          <div className={styles.headerInfo}>
            <div className={styles.headerTop}>
              <span className={styles.numero}>{remito.numero}</span>
              <EstadoRemitoBadge estado={remito.estado} />
            </div>
            <p className={styles.headerSub}>
              {nombreRemito(remito)} · {remito.responsable}
              {remito.empresa_transporte && ` · ${remito.empresa_transporte}`}
              · {formatFecha(remito.fecha_egreso)}
            </p>
          </div>
          <div className={styles.headerActions}>
            {esBorrador   && <button className={styles.btnEdit}   onClick={() => setShowEdit(true)}>✎ Editar datos</button>}
            {esConfirmado && esDueño && <button className={styles.btnVolver} onClick={() => setConfirmVolver(true)}>↩ Volver a borrador</button>}
            {/* Botón QR removido: el QR ahora está inline en la card "Acción"
                del sidebar (visible sin scroll) y también en el PDF impreso. */}
            <button className={styles.btnPDF} onClick={() => imprimirRemito(remito)}
              disabled={esBorrador} title={esBorrador ? 'Disponible desde Confirmado' : 'Exportar PDF'}>
              <span className={styles.btnIcon}>📄</span>
              <span className={styles.btnLabel}>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className={styles.stepper}>
        {PASOS.map((paso, idx) => (
          <div key={paso.key} className={`${styles.paso} ${idx <= pasoActual ? styles.pasoActivo : ''} ${idx === pasoActual ? styles.pasoCurrent : ''}`}>
            <div className={styles.pasoCirculo}>{idx < pasoActual ? '✓' : idx + 1}</div>
            <span className={styles.pasoLabel}>{paso.label}</span>
            {idx < PASOS.length - 1 && <div className={`${styles.pasoLinea} ${idx < pasoActual ? styles.pasoLineaActiva : ''}`} />}
          </div>
        ))}
      </div>

      {errAction && <div className={styles.errorBanner}>⚠ {errAction}</div>}

      <div className={styles.layout}>
        <div className={styles.mainCol}>

          {/* Herramientas */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.cardTitle}>
                Herramientas <span className={styles.cardCount}>{remito.items?.length ?? 0}</span>
              </h2>
              {esBorrador && (
                <button className={styles.btnSecondary} onClick={() => setShowHerrModal(true)}>
                  + Agregar
                </button>
              )}
            </div>

            {(!remito.items?.length)
              ? <div className={styles.emptySection}>Sin herramientas. {esBorrador && 'Usá "+ Agregar" para seleccionar varias a la vez.'}</div>
              : <>
                  {/* Leyenda de colores del estado_salida — visible solo
                      en mobile donde el badge se reemplaza por un punto. */}
                  <div className={styles.leyendaEstados}>
                    Estado:
                    <span className={styles.leyendaItem}><span className={`${styles.leyendaDot} ${styles.bueno}`} /> Bueno</span>
                    <span className={styles.leyendaItem}><span className={`${styles.leyendaDot} ${styles.regular}`} /> Regular</span>
                    <span className={styles.leyendaItem}><span className={`${styles.leyendaDot} ${styles.malo}`} /> Malo</span>
                  </div>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr>
                      <th>Herramienta</th>
                      <th>QR</th>
                      <th>Estado salida</th>
                      {(esRetorno || remito.estado === 'EN_TRANSITO_RETORNO' || remito.estado === 'CERRADO') && <th>Estado retorno</th>}
                      {esBorrador && <th></th>}
                    </tr></thead>
                    <tbody>
                      {remito.items.map(item => (
                        <tr key={item.id} className={styles.row}>
                          <td className={styles.itemNombre}>
                            <div className={styles.itemNombreRow}>
                              <span>{item.herramienta_nombre}</span>
                              {/* Word C / C2: distinguimos "llegó con problema"
                                  vs "no llegó (extraviado)". El extraviado tiene
                                  prioridad visual porque es más grave. */}
                              {item.extraviado ? (
                                <span className={styles.badgeExtraviado}>✕ Extraviado</span>
                              ) : item.tiene_problema && (
                                <span className={styles.badgeProblema}>⚠ Problema</span>
                              )}
                            </div>
                            {item.tiene_problema && item.observacion && (
                              <div className={styles.itemProblemaDesc}>{item.observacion}</div>
                            )}
                          </td>
                          <td className={styles.itemSub}>{item.herramienta_qr}</td>
                          <td>
                            <span className={`${styles.estadoItem} ${styles[item.estado_salida?.toLowerCase() ?? 'bueno']}`}>
                              {item.estado_salida ?? '—'}
                            </span>
                          </td>
                          {esRetorno && (
                            <td>
                              {item.extraviado ? (
                                // Word C2: si el ítem se extravió, no aplica
                                // retorno. Lo omitimos de los controles y
                                // mostramos un placeholder para que se entienda
                                // por qué no está disponible.
                                <span className={styles.extraviadoNote}>— No aplica (extraviado)</span>
                              ) : (
                                <div className={styles.retornoSelector}>
                                  {ESTADOS_RETORNO_HERR.map(er => {
                                    // Optimistic: override local > valor del backend
                                    const valorActual = retornosLocales[item.id] ?? item.estado_retorno
                                    return (
                                      <button key={er.value}
                                        className={`${styles.retornoBtn} ${valorActual === er.value ? styles[er.cls] : ''}`}
                                        onClick={() => handleRetornoHerramienta(item.id, er.value)}>
                                        {er.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                          )}
                          {!esRetorno && (remito.estado === 'EN_TRANSITO_RETORNO' || remito.estado === 'CERRADO') && (
                            <td>
                              {item.extraviado
                                ? <span className={styles.extraviadoNote}>—</span>
                                : item.estado_retorno
                                    ? (
                                      // Pill coloreado según el estado de
                                      // retorno (VUELVE/ROTA/etc). Usamos
                                      // .estadoRetorno (no .estadoItem) para
                                      // que en mobile no se reduzca a un
                                      // punto sin label — el dueño necesita
                                      // ver explícitamente si volvió rota,
                                      // perdida, etc.
                                      <span className={`${styles.estadoRetorno} ${styles[ESTADO_RETORNO_CLS[item.estado_retorno] || '']}`}>
                                        {item.estado_retorno.replace(/_/g, ' ')}
                                      </span>
                                    )
                                    : <span className={styles.estadoItem}>—</span>
                              }
                            </td>
                          )}
                          {esBorrador && (
                            <td><button className={styles.btnRemove} onClick={() => handleRemoveHerramienta(item.id)}>✕</button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Bloque "Herramientas extraviadas" — solo en remito CERRADO
                    o EN_TRANSITO_RETORNO. Cuenta items con extraviado=true
                    o estado_retorno=PERDIDA, suma su valor (h.valor del
                    catálogo de herramientas) y muestra detalle por item. */}
                {(remito.estado === 'CERRADO' || remito.estado === 'EN_TRANSITO_RETORNO') &&
                  <ExtraviosBlock items={remito.items} />}
                </>
            }
          </div>

          {/* Materiales */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.cardTitle}>
                Materiales e insumos <span className={styles.cardCount}>{remito.materiales?.length ?? 0}</span>
              </h2>
              {esBorrador && (
                <button className={styles.btnSecondary} onClick={() => setShowMatModal(true)}>
                  + Agregar
                </button>
              )}
            </div>

            {(!remito.materiales?.length)
              ? <div className={styles.emptySection}>Sin materiales ni insumos.</div>
              : <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr>
                      <th>Material / Insumo</th>
                      <th>Cant. egreso</th>
                      <th>Unidad</th>
                      {(esRetorno || remito.estado === 'EN_TRANSITO_RETORNO' || remito.estado === 'CERRADO') && <th>Cant. retorno</th>}
                      {esBorrador && <th></th>}
                    </tr></thead>
                    <tbody>
                      {remito.materiales.map(m => (
                        <tr key={m.id} className={styles.row}>
                          <td className={styles.itemNombre}>
                            <div className={styles.itemNombreRow}>
                              <span>{m.material_nombre || m.descripcion_libre}</span>
                              {!m.material_id && <span className={styles.libreTag}>libre</span>}
                              {/* Word C / C2: extraviado pisa al badge de problema */}
                              {m.extraviado ? (
                                <span className={styles.badgeExtraviado}>✕ Extraviado</span>
                              ) : m.tiene_problema && (
                                <span className={styles.badgeProblema}>⚠ Problema</span>
                              )}
                            </div>
                            {m.tiene_problema && m.observacion && (
                              <div className={styles.itemProblemaDesc}>{m.observacion}</div>
                            )}
                          </td>
                          <td className={styles.itemSub}>{m.cantidad_egreso}</td>
                          <td className={styles.itemSub}>{m.unidad}</td>
                          {esRetorno && (
                            <td>
                              {(() => {
                                // Override optimistic > valor del backend
                                const cantActual  = cantidadesLocales[m.id]  ?? m.cantidad_retorno
                                const extrActual  = extraviadosLocales[m.id] ?? m.extraviado
                                const cantEgreso  = Number(m.cantidad_egreso)
                                // Modo inferido: si el user clickeó "Parcial" sin commitear todavía, modoLocales manda.
                                // Si no, lo inferimos del estado persistido.
                                let modo = modoLocales[m.id]
                                if (!modo) {
                                  if (extrActual || cantActual === 0)               modo = 'NINGUNO'
                                  else if (cantActual === cantEgreso)               modo = 'TODOS'
                                  else if (cantActual > 0 && cantActual < cantEgreso) modo = 'PARCIAL'
                                }
                                const setModo = (nuevo) => setModoLocales(o => ({ ...o, [m.id]: nuevo }))
                                return (
                                  <div className={styles.retornoCell}>
                                    <div className={styles.retornoOpciones} role="group">
                                      <button type="button"
                                        className={`${styles.retornoBtn} ${modo === 'TODOS' ? styles.retornoBtnActiveOk : ''}`}
                                        onClick={() => { setModo('TODOS'); handleRetornoMaterial(m.id, { cantidadRetorno: cantEgreso, extraviado: false }) }}>
                                        ✓ Todos
                                      </button>
                                      <button type="button"
                                        className={`${styles.retornoBtn} ${modo === 'PARCIAL' ? styles.retornoBtnActiveWarn : ''}`}
                                        onClick={() => { setModo('PARCIAL'); /* esperamos input */ }}>
                                        ⚠ Parcial
                                      </button>
                                      <button type="button"
                                        className={`${styles.retornoBtn} ${modo === 'NINGUNO' ? styles.retornoBtnActiveDanger : ''}`}
                                        onClick={() => { setModo('NINGUNO'); handleRetornoMaterial(m.id, { cantidadRetorno: 0, extraviado: true }) }}>
                                        ✕ Ninguno
                                      </button>
                                    </div>
                                    {modo === 'PARCIAL' && (
                                      <input type="number" min="1" max={cantEgreso - 1} step="1"
                                        className={styles.cantidadRetornoInput}
                                        placeholder={`Cant. recibida (1 a ${cantEgreso - 1})`}
                                        defaultValue={(cantActual > 0 && cantActual < cantEgreso) ? cantActual : ''}
                                        key={`${m.id}-parcial-${m.cantidad_retorno ?? ''}`}
                                        onBlur={e => {
                                          const val = e.target.value
                                          if (val === '') return
                                          const nuevo = Number(val)
                                          if (!Number.isFinite(nuevo) || nuevo < 1 || nuevo >= cantEgreso) {
                                            setErrAction(`Valor inválido. Debe estar entre 1 y ${cantEgreso - 1} (si llegaron todos usá "Todos", si no llegó ninguno usá "Ninguno").`)
                                            return
                                          }
                                          handleRetornoMaterial(m.id, { cantidadRetorno: nuevo, extraviado: false })
                                          setModoLocales(o => ({ ...o, [m.id]: undefined }))
                                        }} />
                                    )}
                                    {modo === 'PARCIAL' && cantActual > 0 && cantActual < cantEgreso && (
                                      <span className={styles.retornoResumen}>Llegaron {cantActual} de {cantEgreso}</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                          )}
                          {!esRetorno && (remito.estado === 'EN_TRANSITO_RETORNO' || remito.estado === 'CERRADO') && (
                            <td className={styles.itemSub}>
                              {m.extraviado ? '—' : (m.cantidad_retorno ?? '—')}
                            </td>
                          )}
                          {esBorrador && (
                            <td><button className={styles.btnRemove} onClick={() => handleRemoveMaterial(m.id)}>✕</button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>

          {/* Acción — PRIMERA en el sidebar para que el QR/botón sea visible
              sin scroll en PC (es el CTA principal del flujo del remito). */}
          {puedeAvanzar && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Acción</h2>
              {esRetorno && (
                <p className={styles.cardDesc}>
                  Definí el estado de retorno de cada herramienta y la cantidad que vuelve de cada material.
                </p>
              )}
              <button className={styles.btnPrimary} onClick={handleAvanzar} disabled={loadingAction}>
                {loadingAction ? 'Procesando...' : LABEL_AVANZAR[remito.estado]}
              </button>
            </div>
          )}

          {/* Confirmación que requiere QR (no-DUEÑO en transiciones de
              tránsito: CONFIRMADO/EN_TRANSITO/EN_TRANSITO_RETORNO).
              BORRADOR y EN_OBRA están en avanceLibre — no llegan acá.
              En PC: QR inline para escanear con el celular del responsable.
              En mobile: botón que navega a la página dedicada del QR mobile
              (RemitoQRPage tiene toda la lógica del flow según estado). */}
          {!puedeAvanzar && !esDueño && remito.estado !== 'CERRADO' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Acción</h2>
              {isMobile ? (
                <>
                  <p className={styles.cardDesc}>
                    Ya estás en el celular — confirmá este remito directamente:
                  </p>
                  <Link to={`/remitos/${id}/qr`} className={styles.btnAvanzar}>
                    📱 Confirmar este remito
                  </Link>
                </>
              ) : (
                <>
                  <p className={styles.cardDesc}>
                    Escaneá este QR con la app FieldStock desde el celular del
                    responsable para confirmar.
                  </p>
                  <div className={styles.qrInlineWrap}>
                    {/* Codeamos el número del remito (FS-NNNNN), no una URL.
                        Coincide con el regex RE_REMITO del scanner. */}
                    <QRCodeSVG
                      value={remito.numero}
                      size={200}
                      level="H"
                      includeMargin
                    />
                    <p className={styles.qrInlineHint}>
                      Código: <strong>{remito.numero}</strong>
                      <br />
                      Si no escanea, el responsable puede tipearlo manual en la app.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className={styles.card}>
          <h2 className={styles.cardTitle}>Datos del remito</h2>
          <div className={styles.campos}>
            {[
              { label: 'Número',        value: remito.numero },
              { label: 'Responsable',   value: remito.responsable },
              { label: 'Fecha egreso',  value: formatFecha(remito.fecha_egreso) },
              { label: 'Fecha retorno', value: formatFecha(remito.fecha_retorno) },
              { label: 'Observación',   value: remito.observacion || '—' },
            ].map(({ label, value }) => (
              <div key={label} className={styles.campo}>
                <span className={styles.campoLabel}>{label}</span>
                <span className={styles.campoValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Info de la obra / cliente */}
        {(remito.cliente_nombre || remito.obra) && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Obra</h2>
            <div className={styles.campos}>
              <div className={styles.campo}>
                <span className={styles.campoLabel}>Nombre</span>
                <span className={styles.campoValue}>{remito.obra}</span>
              </div>
              {remito.cliente_nombre && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Empresa</span>
                  <span className={styles.campoValue}>{remito.cliente_nombre}</span>
                </div>
              )}
              {remito.cliente_telefono && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Teléfono</span>
                  <span className={styles.campoValue}>{remito.cliente_telefono}</span>
                </div>
              )}
              {(remito.cliente_direccion || remito.cliente_localidad) && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Dirección</span>
                  <span className={styles.campoValue}>
                    {[remito.cliente_direccion, remito.cliente_localidad, remito.cliente_provincia]
                      .filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info del transporte */}
        {remito.empresa_transporte && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Transporte</h2>
            <div className={styles.campos}>
              <div className={styles.campo}>
                <span className={styles.campoLabel}>Empresa</span>
                <span className={styles.campoValue}>{remito.empresa_transporte}</span>
              </div>
              {/* Conductor: viene del campo capturado en el QR de salida
                  (remito.conductor), que es quien físicamente está haciendo
                  el traslado. Antes mostrábamos transporte_contacto, que es
                  el contacto genérico de la empresa de transporte — útil
                  para llamarlos, pero no es necesariamente el conductor
                  específico de este envío. */}
              {remito.conductor && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Conductor</span>
                  <span className={styles.campoValue}>{remito.conductor}</span>
                </div>
              )}
              {remito.transporte_telefono && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Tel. transporte</span>
                  <span className={styles.campoValue}>{remito.transporte_telefono}</span>
                </div>
              )}
              {remito.transporte_contacto && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Contacto empresa</span>
                  <span className={styles.campoValue}>{remito.transporte_contacto}</span>
                </div>
              )}
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  )
}
