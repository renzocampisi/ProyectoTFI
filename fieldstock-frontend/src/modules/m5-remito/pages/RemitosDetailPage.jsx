// src/modules/m5-remito/pages/RemitosDetailPage.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRemito } from '../hooks/useRemitos'
import { RemitosService } from '../services/remitos.service'
import { InventarioService } from '@modules/m2-inventario/services/inventario.service'
import { MateriasService } from '@modules/m6-materiales/services/materiales.service'
import EstadoRemitoBadge from '../components/EstadoRemitoBadge'
import styles from './RemitosDetailPage.module.css'

const PASOS = ['BORRADOR','CONFIRMADO','EN_TRANSITO','RECIBIDO_EN_OBRA','CERRADO']
const LABEL_AVANZAR = {
  BORRADOR:         'Confirmar remito',
  CONFIRMADO:       'Marcar en tránsito',
  EN_TRANSITO:      'Confirmar recepción en obra',
  RECIBIDO_EN_OBRA: 'Cerrar remito',
}
const UNIDADES = ['unidad','kg','metro','litro','caja','rollo','juego','par']

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function RemitosDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { remito, loading, error, refetch } = useRemito(id)

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)

  // Herramientas
  const [showHerrBuscador, setShowHerrBuscador] = useState(false)
  const [herrsDisp,        setHerrsDisp]        = useState([])
  const [buscandoHerr,     setBuscandoHerr]     = useState(false)

  // Materiales
  const [showMatBuscador, setShowMatBuscador] = useState(false)
  const [matsDisp,        setMatsDisp]        = useState([])
  const [buscandoMat,     setBuscandoMat]     = useState(false)
  const [modoMat,         setModoMat]         = useState('catalogo')
  const [matSeleccionado, setMatSeleccionado] = useState(null) // { mat, cantidad }
  const [matLibre,        setMatLibre]        = useState({ descripcion: '', cantidad: '', unidad: 'unidad' })

  const action = async (fn) => {
    setLoadingAction(true); setErrAction(null)
    try { await fn(); await refetch() }
    catch (err) { setErrAction(err.message) }
    finally { setLoadingAction(false) }
  }

  const handleAvanzar = () => action(() => RemitosService.avanzar(id))

  const handleCrearIngreso = async () => {
    setLoadingAction(true); setErrAction(null)
    try {
      const ingreso = await RemitosService.crearIngreso(id)
      navigate(`/remitos/${ingreso.id}`)
    } catch (err) { setErrAction(err.message) }
    finally { setLoadingAction(false) }
  }

  const handleBuscarHerramientas = async () => {
    setBuscandoHerr(true)
    try {
      const data = await InventarioService.getAll({ estado: 'DISPONIBLE' })
      const idsYa = remito.items.map(i => i.herramienta_id)
      setHerrsDisp(data.filter(h => !idsYa.includes(h.id)))
      setShowHerrBuscador(true)
    } catch (err) { setErrAction(err.message) }
    finally { setBuscandoHerr(false) }
  }

  const handleAddHerramienta = (herramientaId) =>
    action(async () => {
      await RemitosService.addItem(id, { herramientaId, estadoSalida: 'BUENO' })
      setShowHerrBuscador(false)
    })

  const handleRemoveHerramienta = (itemId) =>
    action(() => RemitosService.removeItem(id, itemId))

  const handleBuscarMateriales = async () => {
    setBuscandoMat(true)
    try {
      const data = await MateriasService.getAll()
      setMatsDisp(data)
      setShowMatBuscador(true)
    } catch (err) { setErrAction(err.message) }
    finally { setBuscandoMat(false) }
  }

  const handleSeleccionarMat = (mat) => {
    setMatSeleccionado({ mat, cantidad: '' })
  }

  const handleConfirmarMatCatalogo = () =>
    action(async () => {
      if (!matSeleccionado?.cantidad || Number(matSeleccionado.cantidad) <= 0) {
        setErrAction('Ingresá una cantidad válida'); return
      }
      await RemitosService.addMaterial(id, {
        materialId: matSeleccionado.mat.id,
        cantidad:   Number(matSeleccionado.cantidad),
        unidad:     matSeleccionado.mat.unidad,
      })
      setMatSeleccionado(null)
      setShowMatBuscador(false)
    })

  const handleAddMatLibre = () =>
    action(async () => {
      if (!matLibre.descripcion.trim() || !matLibre.cantidad || Number(matLibre.cantidad) <= 0) {
        setErrAction('Completá descripción y cantidad'); return
      }
      await RemitosService.addMaterial(id, {
        descripcionLibre: matLibre.descripcion.trim(),
        cantidad: Number(matLibre.cantidad),
        unidad: matLibre.unidad,
      })
      setMatLibre({ descripcion: '', cantidad: '', unidad: 'unidad' })
      setShowMatBuscador(false)
    })

  const handleRemoveMaterial = (matItemId) =>
    action(() => RemitosService.removeMaterial(id, matItemId))

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando remito...</div>
  )
  if (error || !remito) return (
    <div className={styles.noEncontrado}>
      <span>🔍</span><h2>{error || 'Remito no encontrado'}</h2>
      <button className={styles.btnGhost} onClick={() => navigate('/remitos')}>← Volver</button>
    </div>
  )

  const pasoActual   = PASOS.indexOf(remito.estado)
  const esBorrador   = remito.estado === 'BORRADOR'
  const puedeAvanzar = remito.estado !== 'CERRADO'

  return (
    <div className={styles.page}>

      {/* Encabezado */}
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/remitos')}>← Volver</button>
        <div className={styles.headerMain}>
          <div className={styles.headerInfo}>
            <div className={styles.headerTop}>
              <span className={styles.numero}>{remito.numero}</span>
              <span className={`${styles.tipoBadge} ${remito.tipo === 'EGRESO' ? styles.egreso : styles.ingreso}`}>
                {remito.tipo === 'EGRESO' ? '↑ Egreso' : '↓ Ingreso'}
              </span>
              <EstadoRemitoBadge estado={remito.estado} />
            </div>
            <p className={styles.headerSub}>
              {remito.obra} · {remito.responsable}
              {remito.empresa_transporte && ` · ${remito.empresa_transporte}`}
              · {formatFecha(remito.fecha)}
            </p>
          </div>
          <button className={styles.btnPDF} onClick={() => window.print()}>⬇ Exportar PDF</button>
        </div>
      </div>

      {/* Stepper */}
      <div className={styles.stepper}>
        {PASOS.map((paso, idx) => (
          <div key={paso} className={`${styles.paso} ${idx <= pasoActual ? styles.pasoActivo : ''} ${idx === pasoActual ? styles.pasoCurrent : ''}`}>
            <div className={styles.pasoCirculo}>{idx < pasoActual ? '✓' : idx + 1}</div>
            <span className={styles.pasoLabel}>{paso.replace(/_/g,' ').toLowerCase().replace(/^\w/,c=>c.toUpperCase())}</span>
            {idx < PASOS.length - 1 && <div className={`${styles.pasoLinea} ${idx < pasoActual ? styles.pasoLineaActiva : ''}`} />}
          </div>
        ))}
      </div>

      {errAction && <div className={styles.errorBanner}>⚠ {errAction}</div>}

      <div className={styles.layout}>
        <div className={styles.mainCol}>

          {/* ── Herramientas ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.cardTitle}>
                Herramientas <span className={styles.cardCount}>{remito.items?.length ?? 0}</span>
              </h2>
              {esBorrador && (
                <button className={styles.btnSecondary} onClick={handleBuscarHerramientas} disabled={buscandoHerr}>
                  {buscandoHerr ? 'Cargando...' : '+ Agregar'}
                </button>
              )}
            </div>

            {showHerrBuscador && (
              <div className={styles.buscador}>
                <div className={styles.buscadorHeader}>
                  <span className={styles.buscadorTitle}>Herramientas disponibles</span>
                  <button className={styles.btnClose} onClick={() => setShowHerrBuscador(false)}>✕</button>
                </div>
                {herrsDisp.length === 0
                  ? <p className={styles.buscadorEmpty}>No hay herramientas disponibles.</p>
                  : <ul className={styles.buscadorList}>
                      {herrsDisp.map(h => (
                        <li key={h.id} className={styles.buscadorItem}>
                          <div>
                            <span className={styles.buscadorNombre}>{h.nombre}</span>
                            <span className={styles.buscadorSub}>{h.codigo_qr}</span>
                          </div>
                          <button className={styles.btnAdd} onClick={() => handleAddHerramienta(h.id)}>Agregar</button>
                        </li>
                      ))}
                    </ul>
                }
              </div>
            )}

            {(!remito.items?.length)
              ? <div className={styles.emptySection}>Sin herramientas. {esBorrador && 'Agregá al menos una.'}</div>
              : <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr>
                      <th>Herramienta</th><th>QR</th><th>Estado salida</th>
                      {remito.tipo === 'INGRESO' && <th>Estado retorno</th>}
                      {esBorrador && <th></th>}
                    </tr></thead>
                    <tbody>
                      {remito.items.map(item => (
                        <tr key={item.id} className={styles.row}>
                          <td className={styles.itemNombre}>{item.herramienta_nombre}</td>
                          <td className={styles.itemSub}>{item.herramienta_qr}</td>
                          <td><span className={`${styles.estadoItem} ${styles[item.estado_salida?.toLowerCase() ?? 'bueno']}`}>{item.estado_salida ?? '—'}</span></td>
                          {remito.tipo === 'INGRESO' && (
                            <td><span className={`${styles.estadoItem} ${styles[item.estado_retorno?.toLowerCase() ?? '']}`}>{item.estado_retorno ?? '—'}</span></td>
                          )}
                          {esBorrador && <td><button className={styles.btnRemove} onClick={() => handleRemoveHerramienta(item.id)}>✕</button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          {/* ── Materiales ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.cardTitle}>
                Materiales e insumos <span className={styles.cardCount}>{remito.materiales?.length ?? 0}</span>
              </h2>
              {esBorrador && (
                <button className={styles.btnSecondary} onClick={handleBuscarMateriales} disabled={buscandoMat}>
                  {buscandoMat ? 'Cargando...' : '+ Agregar'}
                </button>
              )}
            </div>

            {showMatBuscador && (
              <div className={styles.buscador}>
                <div className={styles.buscadorHeader}>
                  <div className={styles.modoTabs}>
                    <button className={`${styles.modoTab} ${modoMat === 'catalogo' ? styles.modoTabActive : ''}`} onClick={() => { setModoMat('catalogo'); setMatSeleccionado(null) }}>Del catálogo</button>
                    <button className={`${styles.modoTab} ${modoMat === 'libre'    ? styles.modoTabActive : ''}`} onClick={() => { setModoMat('libre');    setMatSeleccionado(null) }}>Descripción libre</button>
                  </div>
                  <button className={styles.btnClose} onClick={() => { setShowMatBuscador(false); setMatSeleccionado(null) }}>✕</button>
                </div>

                {modoMat === 'catalogo' ? (
                  matsDisp.length === 0
                    ? <p className={styles.buscadorEmpty}>No hay materiales en el catálogo.</p>
                    : <>
                        <ul className={styles.buscadorList}>
                          {matsDisp.map(m => (
                            <li key={m.id} className={`${styles.buscadorItem} ${matSeleccionado?.mat.id === m.id ? styles.buscadorItemSelected : ''}`}>
                              <div>
                                <span className={styles.buscadorNombre}>{m.nombre}</span>
                                <span className={styles.buscadorSub}>Stock: {m.stock_actual} {m.unidad}</span>
                              </div>
                              <button className={styles.btnAdd} onClick={() => handleSeleccionarMat(m)}>Seleccionar</button>
                            </li>
                          ))}
                        </ul>

                        {/* Input de cantidad inline */}
                        {matSeleccionado && (
                          <div className={styles.cantidadInline}>
                            <span className={styles.cantidadLabel}>
                              Cantidad de <strong>{matSeleccionado.mat.nombre}</strong> ({matSeleccionado.mat.unidad}):
                            </span>
                            <div className={styles.cantidadRow}>
                              <input
                                type="number" min="0.01" step="0.01"
                                className={styles.cantidadInput}
                                placeholder={`Máx: ${matSeleccionado.mat.stock_actual}`}
                                value={matSeleccionado.cantidad}
                                onChange={e => setMatSeleccionado(s => ({ ...s, cantidad: e.target.value }))}
                                autoFocus
                              />
                              <button className={styles.btnPrimary} onClick={handleConfirmarMatCatalogo}>
                                Confirmar
                              </button>
                              <button className={styles.btnCancelarCant} onClick={() => setMatSeleccionado(null)}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                ) : (
                  <div className={styles.libreForm}>
                    <input type="text" className={styles.input} placeholder="Descripción del material o insumo"
                      value={matLibre.descripcion} onChange={e => setMatLibre(f => ({ ...f, descripcion: e.target.value }))} />
                    <div className={styles.libreRow}>
                      <input type="number" min="0.01" step="0.01" className={styles.input} placeholder="Cantidad"
                        value={matLibre.cantidad} onChange={e => setMatLibre(f => ({ ...f, cantidad: e.target.value }))} />
                      <select className={styles.select} value={matLibre.unidad} onChange={e => setMatLibre(f => ({ ...f, unidad: e.target.value }))}>
                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button className={styles.btnAdd} onClick={handleAddMatLibre}>Agregar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(!remito.materiales?.length)
              ? <div className={styles.emptySection}>Sin materiales ni insumos.</div>
              : <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr>
                      <th>Material / Insumo</th><th>Cantidad</th><th>Unidad</th>
                      {esBorrador && <th></th>}
                    </tr></thead>
                    <tbody>
                      {remito.materiales.map(m => (
                        <tr key={m.id} className={styles.row}>
                          <td className={styles.itemNombre}>
                            {m.material_nombre || m.descripcion_libre}
                            {!m.material_id && <span className={styles.libreTag}>libre</span>}
                          </td>
                          <td className={styles.itemSub}>{m.cantidad}</td>
                          <td className={styles.itemSub}>{m.unidad}</td>
                          {esBorrador && <td><button className={styles.btnRemove} onClick={() => handleRemoveMaterial(m.id)}>✕</button></td>}
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
                { label: 'Número',      value: remito.numero },
                { label: 'Tipo',        value: remito.tipo },
                { label: 'Obra',        value: remito.obra },
                { label: 'Responsable', value: remito.responsable },
                { label: 'Transporte',  value: remito.empresa_transporte || '—' },
                { label: 'Fecha',       value: formatFecha(remito.fecha) },
                { label: 'Observación', value: remito.observacion || '—' },
              ].map(({ label, value }) => (
                <div key={label} className={styles.campo}>
                  <span className={styles.campoLabel}>{label}</span>
                  <span className={styles.campoValue}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {puedeAvanzar && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Acción</h2>
              <button className={styles.btnPrimary} onClick={handleAvanzar} disabled={loadingAction}>
                {loadingAction ? 'Procesando...' : LABEL_AVANZAR[remito.estado]}
              </button>
            </div>
          )}

          {remito.tipo === 'EGRESO' && ['RECIBIDO_EN_OBRA','CERRADO'].includes(remito.estado) && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Devolución</h2>
              <p className={styles.cardDesc}>Generá el remito de ingreso cuando los ítems vuelvan de obra.</p>
              <button className={styles.btnSecondary} onClick={handleCrearIngreso} disabled={loadingAction}>
                Crear remito de ingreso
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
