// src/modules/m5-remito/pages/RemitosDetailPage.jsx
import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRemito } from '../hooks/useRemitos'
import { RemitosService } from '../services/remitos.service'
import { InventarioService } from '@modules/m2-inventario/services/inventario.service'
import { MateriasService } from '@modules/m6-materiales/services/materiales.service'
import EstadoRemitoBadge from '../components/EstadoRemitoBadge'
import RemitoEditModal from './RemitoEditModal'
import RemitoPrint from './RemitoPrint'
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

const UNIDADES = ['unidad','kg','metro','litro','caja','rollo','juego','par']

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
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
      <script>window.onload = () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 1000) }, 300) }<\/script>
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

  useState(() => {
    InventarioService.getAll({ estado: 'DISPONIBLE' })
      .then(data => setHerramientas(data.filter(h => !idsYa.includes(h.id))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
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
    finally { setSaving(false) }
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

  useState(() => {
    MateriasService.getAll()
      .then(data => setMateriales(data.filter(m => m.stock_actual > 0 && !idsYa.includes(m.id))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
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

  const handleAgregar = async () => {
    // Validar que todos los seleccionados tengan cantidad
    const sinCantidad = [...seleccionados].filter(id => !cantidades[id] || Number(cantidades[id]) <= 0)
    if (sinCantidad.length) { setError('Ingresá la cantidad de cada material seleccionado.'); return }

    setSaving(true); setError(null)
    try {
      const mat = materiales.reduce((acc, m) => ({ ...acc, [m.id]: m }), {})
      await Promise.all(
        [...seleccionados].map(id =>
          RemitosService.addMaterial(remitoId, {
            materialId: id,
            cantidad:   Number(cantidades[id]),
            unidad:     mat[id].unidad,
          })
        )
      )
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleAddLibre = async () => {
    if (!matLibre.descripcion.trim() || !matLibre.cantidad || Number(matLibre.cantidad) <= 0) {
      setError('Completá descripción y cantidad'); return
    }
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
    finally { setSaving(false) }
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
                {filtrados.map(m => (
                  <li key={m.id}
                    className={`${styles.checkItem} ${seleccionados.has(m.id) ? styles.checkItemSelected : ''}`}>
                    <input type="checkbox" checked={seleccionados.has(m.id)}
                      onChange={() => toggleMat(m.id)} />
                    <div className={styles.checkInfo} onClick={() => toggleMat(m.id)}>
                      <span className={styles.checkNombre}>{m.nombre}</span>
                      <span className={styles.checkSub}>Stock: {m.stock_actual} {m.unidad}</span>
                    </div>
                    {seleccionados.has(m.id) && (
                      <input
                        type="number" min="1" step="1"
                        className={styles.cantidadInputInline}
                        placeholder={`Máx ${m.stock_actual}`}
                        value={cantidades[m.id] || ''}
                        onChange={e => setCantidad(m.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.modalFooter}>
              <span className={styles.seleccionadosCount}>
                {seleccionados.size > 0
                  ? `${seleccionados.size} material${seleccionados.size !== 1 ? 'es' : ''} seleccionado${seleccionados.size !== 1 ? 's' : ''}`
                  : 'Ninguno seleccionado'}
              </span>
              <div className={styles.modalActions}>
                <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
                <button className={styles.btnPrimary}
                  onClick={handleAgregar}
                  disabled={saving || seleccionados.size === 0}>
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

// ── Página principal ──────────────────────────────────────────
export default function RemitosDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { remito, loading, error, refetch } = useRemito(id)

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)
  const [showEdit,      setShowEdit]      = useState(false)
  const [confirmVolver, setConfirmVolver] = useState(false)
  const [showHerrModal, setShowHerrModal] = useState(false)
  const [showMatModal,  setShowMatModal]  = useState(false)

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
  const handleRetornoHerramienta = (itemId, estadoRetorno) =>
    action(() => RemitosService.updateItemRetorno(id, itemId, { estadoRetorno }))
  const handleRemoveMaterial = (matItemId) => action(() => RemitosService.removeMaterial(id, matItemId))
  const handleRetornoMaterial = (matItemId, cantidadRetorno) =>
    action(() => RemitosService.updateMaterialRetorno(id, matItemId, { cantidadRetorno: Number(cantidadRetorno) }))

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
  const esRetorno    = remito.estado === 'EN_RETORNO'
  const puedeAvanzar = remito.estado !== 'CERRADO'

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
              {remito.obra} · {remito.responsable}
              {remito.empresa_transporte && ` · ${remito.empresa_transporte}`}
              · {formatFecha(remito.fecha_egreso)}
            </p>
          </div>
          <div className={styles.headerActions}>
            {esBorrador   && <button className={styles.btnEdit}   onClick={() => setShowEdit(true)}>✎ Editar datos</button>}
            {esConfirmado && <button className={styles.btnVolver} onClick={() => setConfirmVolver(true)}>↩ Volver a borrador</button>}
            <button className={styles.btnPDF} onClick={() => imprimirRemito(remito)}
              disabled={esBorrador} title={esBorrador ? 'Disponible desde Confirmado' : 'Exportar PDF'}>
              📄 PDF
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
              : <div className={styles.tableWrapper}>
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
                          <td className={styles.itemNombre}>{item.herramienta_nombre}</td>
                          <td className={styles.itemSub}>{item.herramienta_qr}</td>
                          <td>
                            <span className={`${styles.estadoItem} ${styles[item.estado_salida?.toLowerCase() ?? 'bueno']}`}>
                              {item.estado_salida ?? '—'}
                            </span>
                          </td>
                          {esRetorno && (
                            <td>
                              <div className={styles.retornoSelector}>
                                {ESTADOS_RETORNO_HERR.map(er => (
                                  <button key={er.value}
                                    className={`${styles.retornoBtn} ${item.estado_retorno === er.value ? styles[er.cls] : ''}`}
                                    onClick={() => handleRetornoHerramienta(item.id, er.value)}>
                                    {er.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          )}
                          {!esRetorno && (remito.estado === 'EN_TRANSITO_RETORNO' || remito.estado === 'CERRADO') && (
                            <td><span className={styles.estadoItem}>{item.estado_retorno?.replace(/_/g,' ') ?? '—'}</span></td>
                          )}
                          {esBorrador && (
                            <td><button className={styles.btnRemove} onClick={() => handleRemoveHerramienta(item.id)}>✕</button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                            {m.material_nombre || m.descripcion_libre}
                            {!m.material_id && <span className={styles.libreTag}>libre</span>}
                          </td>
                          <td className={styles.itemSub}>{m.cantidad_egreso}</td>
                          <td className={styles.itemSub}>{m.unidad}</td>
                          {esRetorno && (
                            <td>
                              <input type="number" min="0" step="1"
                                className={styles.cantidadRetornoInput}
                                placeholder={`Máx: ${m.cantidad_egreso}`}
                                defaultValue={m.cantidad_retorno ?? ''}
                                onBlur={e => {
                                  const val = e.target.value
                                  if (val !== '' && Number(val) !== m.cantidad_retorno)
                                    handleRetornoMaterial(m.id, val === '' ? 0 : val)
                                }} />
                            </td>
                          )}
                          {!esRetorno && (remito.estado === 'EN_TRANSITO_RETORNO' || remito.estado === 'CERRADO') && (
                            <td className={styles.itemSub}>{m.cantidad_retorno ?? '—'}</td>
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
              {remito.transporte_contacto && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Conductor</span>
                  <span className={styles.campoValue}>{remito.transporte_contacto}</span>
                </div>
              )}
              {remito.transporte_telefono && (
                <div className={styles.campo}>
                  <span className={styles.campoLabel}>Teléfono</span>
                  <span className={styles.campoValue}>{remito.transporte_telefono}</span>
                </div>
              )}
            </div>
          </div>
        )}

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
        </div>
      </div>
    </div>
  )
}
