// src/modules/m-presupuestos/pages/PresupuestoDetailPage.jsx
/**
 * Página de detalle del presupuesto. Los insumos son read-only acá — se
 * cargan solo mientras está en BORRADOR desde el form de creación o desde
 * Kits de Montaje/Panel IA. Mano de obra y costos extra SÍ son editables
 * acá mientras el presupuesto esté en BORRADOR: un presupuesto creado por
 * IA (Kits de Montaje nunca manda mano de obra; el Panel IA solo si el
 * usuario la mencionó) puede necesitar completarse a mano después — el
 * "presupuesto" en este sistema abarca todo el trabajo, no solo materiales.
 * Esta página también cubre las transiciones de estado (enviar a
 * aprobación, aprobar/rechazar, volver a borrador, eliminar) y las
 * acciones de PDF (descargar/imprimir/enviar por mail).
 *
 * Layout:
 *   - Header con número, badge de estado, link a la obra, total grande.
 *   - Card "Datos generales": observaciones, %ganancia, fechas.
 *   - Card "Insumos": tabla con material/cantidad/precio/subtotal.
 *   - Card "Mano de obra" y "Costos extra": editables en BORRADOR.
 *   - Card "Totales": breakdown subtotales + ganancia + total final.
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { LuDownload, LuPrinter, LuMail } from 'react-icons/lu'
import { usePresupuesto } from '../hooks/usePresupuestos'
import { PresupuestosService } from '../services/presupuestos.service'
import EstadoPresupuestoBadge from '../components/EstadoPresupuestoBadge'
import ConfigurarRemitoModal from '../components/ConfigurarRemitoModal'
import {
  descargarPdfPresupuesto,
  imprimirPdfPresupuesto,
} from '../utils/pdfGenerator'
import { useAuth } from '@shared/hooks/useAuth'
import { esDueño } from '@shared/constants/roles'
import {
  CATEGORIA_INFO, CATEGORIA_MANO_OBRA, CATEGORIAS_EXTRA,
  formatMoney, formatCantidad, formatFechaHora,
} from '../constants'
import styles from './PresupuestoDetailPage.module.css'

function Campo({ label, value }) {
  return (
    <div className={styles.campo}>
      <span className={styles.campoLabel}>{label}</span>
      <span className={styles.campoValue}>{value ?? '—'}</span>
    </div>
  )
}

export default function PresupuestoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { presupuesto, loading, error, refetch } = usePresupuesto(id)
  const [accion,       setAccion]       = useState(null) // null | 'enviar' | 'aprobar' | 'rechazar' | 'volver' | 'eliminar'
  const [accionando,   setAccionando]   = useState(false)
  const [errAccion,    setErrAccion]    = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  // remito generado por aprobar() — si la RPC creo uno, abrimos el
  // modal de "configurar transporte y responsable" sobre ese remito.
  const [remitoConfigId, setRemitoConfigId] = useState(null)

  // Mano de obra / costos extra — editables solo en BORRADOR. Cada acción
  // pega directo contra el endpoint (los ítems ya existen en el server, a
  // diferencia del form de creación que junta todo antes de guardar).
  const [costoError,    setCostoError]    = useState(null)
  const [guardandoCosto, setGuardandoCosto] = useState(false)
  const [nuevoManoObra, setNuevoManoObra] = useState(null) // null = form cerrado
  const [nuevoExtra,    setNuevoExtra]    = useState(null)

  const puedeAprobar = esDueño(profile?.role)

  const cerrarModal = () => { setAccion(null); setMotivoRechazo(''); setErrAccion(null) }

  const ejecutar = async (fn, { redirectAfter = null } = {}) => {
    setAccionando(true); setErrAccion(null)
    try {
      await fn()
      if (redirectAfter) navigate(redirectAfter)
      else { await refetch(); cerrarModal() }
    } catch (err) { setErrAccion(err.message); setAccionando(false) }
    finally { if (!redirectAfter) setAccionando(false) }
  }

  const handleEnviar    = () => ejecutar(() => PresupuestosService.enviarAprobacion(id))
  const handleVolver    = () => ejecutar(() => PresupuestosService.volverABorrador(id))
  // aprobar(): el response incluye `remitoGeneradoId` si la RPC creo
  // un remito (puede ser null si el presupuesto no tenia insumos).
  // Cuando hay remito, abrimos el modal post-aprobacion para asignar
  // transporte + responsable. Si no, flujo normal (refetch y cerrar).
  const handleAprobar = async () => {
    setAccionando(true); setErrAccion(null)
    try {
      const res = await PresupuestosService.aprobar(id)
      await refetch()
      cerrarModal()
      if (res?.remitoGeneradoId) {
        setRemitoConfigId(res.remitoGeneradoId)
      }
    } catch (err) {
      setErrAccion(err.message)
    } finally {
      setAccionando(false)
    }
  }
  const handleRechazar  = () => ejecutar(() => PresupuestosService.rechazar(id, motivoRechazo))
  const handleEliminar  = () => ejecutar(
    () => PresupuestosService.remove(id),
    { redirectAfter: presupuesto?.obra?.id ? `/obras/${presupuesto.obra.id}` : '/obras' }
  )

  const handleDescargarPdf = () => {
    if (!presupuesto) return
    descargarPdfPresupuesto(presupuesto)
  }

  const handleImprimirPdf = () => {
    if (!presupuesto) return
    try {
      imprimirPdfPresupuesto(presupuesto)
    } catch (err) {
      setErrAccion(err.message || 'No se pudo abrir la impresion.')
    }
  }

  // Enviar por mail: el estandar `mailto:` no permite adjuntar archivos,
  // asi que descargamos el PDF y abrimos el cliente de mail con asunto
  // y cuerpo prellenados. El usuario adjunta el PDF descargado manualmente.
  const handleEnviarPorMail = () => {
    if (!presupuesto) return
    descargarPdfPresupuesto(presupuesto)
    const emailCliente = presupuesto.obra?.cliente_rel?.email || ''
    const obra = presupuesto.obra?.nombre || 'la obra'
    const asunto = encodeURIComponent(`Presupuesto ${presupuesto.numero} - ${obra}`)
    const cuerpo = encodeURIComponent(
      `Hola,\n\nTe envio el presupuesto ${presupuesto.numero} correspondiente a "${obra}".\n\n` +
      `Por favor adjuntar el PDF que se descargo automaticamente al disparar esta accion.\n\n` +
      `Saludos.`
    )
    window.location.href = `mailto:${emailCliente}?subject=${asunto}&body=${cuerpo}`
  }

  // ── Mano de obra / costos extra ──────────────────────────────
  const handleUpdateCosto = async (costoId, campo, valor) => {
    setCostoError(null)
    try {
      await PresupuestosService.updateCosto(id, costoId, { [campo]: valor })
      await refetch()
    } catch (err) { setCostoError(err.message) }
  }

  const handleRemoveCosto = async (costoId) => {
    setCostoError(null)
    try {
      await PresupuestosService.removeCosto(id, costoId)
      await refetch()
    } catch (err) { setCostoError(err.message) }
  }

  const handleAgregarManoObra = async () => {
    if (!nuevoManoObra?.descripcion?.trim()) { setCostoError('Completá el rubro'); return }
    setGuardandoCosto(true); setCostoError(null)
    try {
      await PresupuestosService.addCosto(id, {
        categoria:      CATEGORIA_MANO_OBRA,
        descripcion:    nuevoManoObra.descripcion.trim(),
        cantidad:       Number(nuevoManoObra.cantidad) || 1,
        costoUnitario:  Number(nuevoManoObra.costo) || 0,
      })
      setNuevoManoObra(null)
      await refetch()
    } catch (err) { setCostoError(err.message) }
    finally { setGuardandoCosto(false) }
  }

  const handleAgregarExtra = async () => {
    if (!nuevoExtra?.descripcion?.trim()) { setCostoError('Completá la descripción'); return }
    setGuardandoCosto(true); setCostoError(null)
    try {
      await PresupuestosService.addCosto(id, {
        categoria:      nuevoExtra.categoria,
        descripcion:    nuevoExtra.descripcion.trim(),
        cantidad:       Number(nuevoExtra.cantidad) || 1,
        unidad:         nuevoExtra.unidad || null,
        costoUnitario:  Number(nuevoExtra.costo) || 0,
      })
      setNuevoExtra(null)
      await refetch()
    } catch (err) { setCostoError(err.message) }
    finally { setGuardandoCosto(false) }
  }

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando presupuesto...</div>
  )
  if (error || !presupuesto) return (
    <div className={styles.noEncontrado}>
      <p>No encontramos el presupuesto que buscás.</p>
      <button className={styles.btnGhost} onClick={() => navigate(-1)}>← Volver</button>
    </div>
  )

  // Agrupar costos por categoria para mostrar
  const costosPorCategoria = (presupuesto.costos || []).reduce((acc, c) => {
    (acc[c.categoria] ||= []).push(c)
    return acc
  }, {})

  // Calcular markup (visualizacion)
  const subInsumos = Number(presupuesto.subtotal_insumos) || 0
  const subCostos  = Number(presupuesto.subtotal_costos)  || 0
  const pct        = Number(presupuesto.porcentaje_ganancia) || 0
  const ganancia   = subInsumos * (pct / 100)

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate(-1)}>← Volver</button>
        <div className={styles.headerMain}>
          <div className={styles.headerLeft}>
            <div className={styles.numero}>{presupuesto.numero}</div>
            <div className={styles.subInfo}>
              <EstadoPresupuestoBadge estado={presupuesto.estado} />
              {presupuesto.obra && (
                <>
                  <span className={styles.subDot}>·</span>
                  <Link to={`/obras/${presupuesto.obra.id}`} className={styles.linkObra}>
                    Obra: {presupuesto.obra.nombre}
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalValue}>{formatMoney(presupuesto.total)}</span>
            <div className={styles.pdfActions}>
              <button type="button" className={styles.btnPdf} onClick={handleDescargarPdf}
                title="Descargar el PDF del presupuesto">
                <LuDownload size={14} /> Descargar
              </button>
              <button type="button" className={styles.btnPdfGhost} onClick={handleImprimirPdf}
                title="Abrir el PDF e imprimir">
                <LuPrinter size={14} /> Imprimir
              </button>
              <button type="button" className={styles.btnPdfGhost} onClick={handleEnviarPorMail}
                title="Descarga el PDF y abre tu cliente de mail con el mensaje prellenado. El PDF hay que adjuntarlo a mano.">
                <LuMail size={14} /> Enviar por Mail
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Datos generales */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Datos generales</h2>
        <div className={styles.camposGrid}>
          <Campo label="Cliente"          value={presupuesto.obra?.cliente} />
          <Campo label="Dirección obra"   value={presupuesto.obra?.direccion} />
          <Campo label="% Ganancia"       value={`${pct}%`} />
          <Campo label="Fecha creación"   value={formatFechaHora(presupuesto.fecha_creacion)} />
          <Campo label="Fecha envío"      value={formatFechaHora(presupuesto.fecha_envio)} />
          <Campo label="Fecha aprobación" value={formatFechaHora(presupuesto.fecha_aprobacion)} />
          {/* Issue menor 3.11: mostrar quién aprobó. Solo aparece si
              hay aprobador resuelto (el join del backend devuelve null
              si aprobado_por es null o si el user fue eliminado). */}
          {presupuesto.aprobador && (
            <Campo label="Aprobado por"
              value={presupuesto.aprobador.nombre || presupuesto.aprobador.id} />
          )}
        </div>
        {presupuesto.observaciones && (
          <div className={styles.observaciones}>
            <span className={styles.campoLabel}>Observaciones</span>
            <p className={styles.observacionesText}>{presupuesto.observaciones}</p>
          </div>
        )}
        {presupuesto.motivo_rechazo && (
          <div className={styles.observaciones}>
            <span className={styles.campoLabel}>Motivo del rechazo</span>
            <p className={styles.observacionesText}>{presupuesto.motivo_rechazo}</p>
          </div>
        )}
      </section>

      {/* Insumos */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Insumos
          <span className={styles.cardCount}>{presupuesto.insumos?.length ?? 0}</span>
        </h2>
        {(!presupuesto.insumos?.length) ? (
          <div className={styles.empty}>Sin insumos cargados.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr>
                <th>Material</th>
                <th className={styles.tdNum}>Cantidad</th>
                <th>Unidad</th>
                <th className={styles.tdNum}>Precio unit.</th>
                <th className={styles.tdNum}>Subtotal</th>
              </tr></thead>
              <tbody>
                {presupuesto.insumos.map(i => (
                  <tr key={i.id}>
                    <td>{i.material?.nombre || '—'}</td>
                    <td className={styles.tdNum}>{formatCantidad(i.cantidad)}</td>
                    <td>{i.material?.unidad || 'unidad'}</td>
                    <td className={styles.tdNum}>{formatMoney(i.precio_unitario)}</td>
                    <td className={styles.tdNum}>{formatMoney(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className={styles.tdSubtotalLabel}>Subtotal insumos</td>
                  <td className={styles.tdNum}><strong>{formatMoney(subInsumos)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Costos extra */}
      {/* Mano de obra (bloque separado, sin columna unidad) y
          Costos extras (todas las demas categorias, con unidad).
          Antes era un solo "Costos extra" que mezclaba todo. */}
      {(() => {
        const manoObra = costosPorCategoria[CATEGORIA_MANO_OBRA] || []
        const costosExtraEntries = Object.entries(costosPorCategoria)
          .filter(([cat]) => cat !== CATEGORIA_MANO_OBRA)
        const totalExtras = costosExtraEntries.reduce((s, [, it]) => s + it.length, 0)
        const editable = presupuesto.estado === 'BORRADOR'
        return (
          <>
            {costoError && <div className={styles.errorBanner}>⚠ {costoError}</div>}

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                {CATEGORIA_INFO[CATEGORIA_MANO_OBRA]?.icon} Mano de obra
                <span className={styles.cardCount}>{manoObra.length}</span>
              </h2>
              {manoObra.length === 0 && !editable ? (
                <div className={styles.empty}>Sin items de mano de obra.</div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr>
                      <th>Rubro</th>
                      <th className={styles.tdNum}>Cantidad</th>
                      <th className={styles.tdNum}>Costo unit.</th>
                      <th className={styles.tdNum}>Subtotal</th>
                      {editable && <th></th>}
                    </tr></thead>
                    <tbody>
                      {manoObra.map(c => (
                        <tr key={c.id}>
                          {editable ? (
                            <>
                              <td>
                                <input type="text" className={styles.inputEdit}
                                  defaultValue={c.descripcion}
                                  onBlur={e => e.target.value.trim() && e.target.value !== c.descripcion
                                    && handleUpdateCosto(c.id, 'descripcion', e.target.value.trim())} />
                              </td>
                              <td className={styles.tdNum}>
                                <input type="number" min="0.01" step="any" className={styles.inputEditNum}
                                  defaultValue={c.cantidad}
                                  onBlur={e => Number(e.target.value) !== Number(c.cantidad)
                                    && handleUpdateCosto(c.id, 'cantidad', Number(e.target.value))} />
                              </td>
                              <td className={styles.tdNum}>
                                <input type="number" min="0" step="any" className={styles.inputEditNum}
                                  defaultValue={c.costo_unitario}
                                  onBlur={e => Number(e.target.value) !== Number(c.costo_unitario)
                                    && handleUpdateCosto(c.id, 'costoUnitario', Number(e.target.value))} />
                              </td>
                              <td className={styles.tdNum}>{formatMoney(c.subtotal)}</td>
                              <td>
                                <button type="button" className={styles.btnEliminarFila}
                                  onClick={() => handleRemoveCosto(c.id)} title="Quitar">🗑</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{c.descripcion}</td>
                              <td className={styles.tdNum}>{formatCantidad(c.cantidad)}</td>
                              <td className={styles.tdNum}>{formatMoney(c.costo_unitario)}</td>
                              <td className={styles.tdNum}>{formatMoney(c.subtotal)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editable && (
                nuevoManoObra ? (
                  <div className={styles.rowAdd}>
                    <input type="text" className={styles.inputEdit} placeholder="Rubro (ej. Oficial + ayudante x 3 días)"
                      value={nuevoManoObra.descripcion}
                      onChange={e => setNuevoManoObra(n => ({ ...n, descripcion: e.target.value }))} />
                    <input type="number" min="0.01" step="any" className={styles.inputEditNum} placeholder="Cant."
                      value={nuevoManoObra.cantidad}
                      onChange={e => setNuevoManoObra(n => ({ ...n, cantidad: e.target.value }))} />
                    <input type="number" min="0" step="any" className={styles.inputEditNum} placeholder="Costo unit."
                      value={nuevoManoObra.costo}
                      onChange={e => setNuevoManoObra(n => ({ ...n, costo: e.target.value }))} />
                    <button type="button" className={styles.btnGhost} onClick={() => setNuevoManoObra(null)} disabled={guardandoCosto}>Cancelar</button>
                    <button type="button" className={styles.btnPrimary} onClick={handleAgregarManoObra} disabled={guardandoCosto}>
                      {guardandoCosto ? 'Guardando...' : 'Agregar'}
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.btnLink}
                    onClick={() => setNuevoManoObra({ descripcion: '', cantidad: '1', costo: '' })}>
                    + Agregar mano de obra
                  </button>
                )
              )}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                Costos extra
                <span className={styles.cardCount}>{totalExtras}</span>
              </h2>
              {totalExtras === 0 && !editable ? (
                <div className={styles.empty}>Sin costos extra cargados.</div>
              ) : (
                costosExtraEntries.map(([cat, items]) => (
                  <div key={cat} className={styles.categoriaBlock}>
                    <h3 className={styles.categoriaTitle}>
                      {CATEGORIA_INFO[cat]?.icon} {CATEGORIA_INFO[cat]?.label || cat}
                    </h3>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead><tr>
                          <th>Descripción</th>
                          <th className={styles.tdNum}>Cantidad</th>
                          <th>Unidad</th>
                          <th className={styles.tdNum}>Costo unit.</th>
                          <th className={styles.tdNum}>Subtotal</th>
                          {editable && <th></th>}
                        </tr></thead>
                        <tbody>
                          {items.map(c => (
                            <tr key={c.id}>
                              {editable ? (
                                <>
                                  <td>
                                    <input type="text" className={styles.inputEdit}
                                      defaultValue={c.descripcion}
                                      onBlur={e => e.target.value.trim() && e.target.value !== c.descripcion
                                        && handleUpdateCosto(c.id, 'descripcion', e.target.value.trim())} />
                                  </td>
                                  <td className={styles.tdNum}>
                                    <input type="number" min="0.01" step="any" className={styles.inputEditNum}
                                      defaultValue={c.cantidad}
                                      onBlur={e => Number(e.target.value) !== Number(c.cantidad)
                                        && handleUpdateCosto(c.id, 'cantidad', Number(e.target.value))} />
                                  </td>
                                  <td>
                                    <input type="text" className={styles.inputEdit}
                                      defaultValue={c.unidad || ''}
                                      onBlur={e => e.target.value !== (c.unidad || '')
                                        && handleUpdateCosto(c.id, 'unidad', e.target.value)} />
                                  </td>
                                  <td className={styles.tdNum}>
                                    <input type="number" min="0" step="any" className={styles.inputEditNum}
                                      defaultValue={c.costo_unitario}
                                      onBlur={e => Number(e.target.value) !== Number(c.costo_unitario)
                                        && handleUpdateCosto(c.id, 'costoUnitario', Number(e.target.value))} />
                                  </td>
                                  <td className={styles.tdNum}>{formatMoney(c.subtotal)}</td>
                                  <td>
                                    <button type="button" className={styles.btnEliminarFila}
                                      onClick={() => handleRemoveCosto(c.id)} title="Quitar">🗑</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td>{c.descripcion}</td>
                                  <td className={styles.tdNum}>{formatCantidad(c.cantidad)}</td>
                                  <td>{c.unidad || '—'}</td>
                                  <td className={styles.tdNum}>{formatMoney(c.costo_unitario)}</td>
                                  <td className={styles.tdNum}>{formatMoney(c.subtotal)}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
              {editable && (
                nuevoExtra ? (
                  <div className={styles.rowAdd}>
                    <select className={styles.inputEdit}
                      value={nuevoExtra.categoria}
                      onChange={e => setNuevoExtra(n => ({ ...n, categoria: e.target.value }))}>
                      {CATEGORIAS_EXTRA.map(cat => (
                        <option key={cat} value={cat}>{CATEGORIA_INFO[cat]?.label || cat}</option>
                      ))}
                    </select>
                    <input type="text" className={styles.inputEdit} placeholder="Descripción"
                      value={nuevoExtra.descripcion}
                      onChange={e => setNuevoExtra(n => ({ ...n, descripcion: e.target.value }))} />
                    <input type="number" min="0.01" step="any" className={styles.inputEditNum} placeholder="Cant."
                      value={nuevoExtra.cantidad}
                      onChange={e => setNuevoExtra(n => ({ ...n, cantidad: e.target.value }))} />
                    <input type="text" className={styles.inputEdit} placeholder="Unidad" style={{ maxWidth: 90 }}
                      value={nuevoExtra.unidad}
                      onChange={e => setNuevoExtra(n => ({ ...n, unidad: e.target.value }))} />
                    <input type="number" min="0" step="any" className={styles.inputEditNum} placeholder="Costo unit."
                      value={nuevoExtra.costo}
                      onChange={e => setNuevoExtra(n => ({ ...n, costo: e.target.value }))} />
                    <button type="button" className={styles.btnGhost} onClick={() => setNuevoExtra(null)} disabled={guardandoCosto}>Cancelar</button>
                    <button type="button" className={styles.btnPrimary} onClick={handleAgregarExtra} disabled={guardandoCosto}>
                      {guardandoCosto ? 'Guardando...' : 'Agregar'}
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.btnLink}
                    onClick={() => setNuevoExtra({ categoria: CATEGORIAS_EXTRA[0], descripcion: '', cantidad: '1', unidad: '', costo: '' })}>
                    + Agregar costo extra
                  </button>
                )
              )}
            </section>
          </>
        )
      })()}

      {/* Totales */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Totales</h2>
        <div className={styles.totales}>
          <div className={styles.totalRow}>
            <span>Subtotal insumos</span>
            <span>{formatMoney(subInsumos)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>+ Ganancia ({pct}% sobre insumos)</span>
            <span>{formatMoney(ganancia)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>+ Mano de obra y costos extra (sin markup)</span>
            <span>{formatMoney(subCostos)}</span>
          </div>
          <div className={`${styles.totalRow} ${styles.totalFinal}`}>
            <span>Total</span>
            <span>{formatMoney(presupuesto.total)}</span>
          </div>
        </div>
      </section>

      {/* Acciones según estado. Sale solo si el estado actual habilita
          alguna transición. APROBADO muestra link al remito. */}
      {(presupuesto.estado === 'BORRADOR' ||
        presupuesto.estado === 'EN_APROBACION' ||
        presupuesto.estado === 'APROBADO') && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Acciones</h2>
          {errAccion && <div className={styles.errorBanner}>⚠ {errAccion}</div>}

          {presupuesto.estado === 'BORRADOR' && (
            <div className={styles.acciones}>
              <button type="button" className={styles.btnGhost}
                onClick={() => setAccion('eliminar')} disabled={accionando}>
                🗑 Eliminar
              </button>
              <button type="button" className={styles.btnPrimary}
                onClick={() => setAccion('enviar')} disabled={accionando}>
                Enviar a aprobación →
              </button>
            </div>
          )}

          {presupuesto.estado === 'EN_APROBACION' && (
            <>
              <p className={styles.hint}>
                El presupuesto está esperando aprobación.
                {!puedeAprobar && ' Solo DUEÑO o ADMIN pueden aprobar/rechazar.'}
              </p>
              <div className={styles.acciones}>
                <button type="button" className={styles.btnGhost}
                  onClick={() => setAccion('volver')} disabled={accionando}>
                  ← Volver a borrador
                </button>
                {puedeAprobar && (
                  <>
                    <button type="button" className={styles.btnDanger}
                      onClick={() => setAccion('rechazar')} disabled={accionando}>
                      ✕ Rechazar
                    </button>
                    <button type="button" className={styles.btnPrimary}
                      onClick={() => setAccion('aprobar')} disabled={accionando}>
                      ✓ Aprobar
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {presupuesto.estado === 'APROBADO' && presupuesto.remito_generado_id && (
            <div className={styles.aprobadoInfo}>
              <p className={styles.hint}>
                Presupuesto aprobado. Se generó un remito BORRADOR con los insumos —
                el operador debe completar transporte y responsable antes de confirmarlo.
              </p>
              <Link to={`/remitos/${presupuesto.remito_generado_id}`} className={styles.btnSecondary}>
                Ir al remito generado →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Modal: confirmar enviar a aprobación */}
      {accion === 'enviar' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>¿Enviar a aprobación?</h3>
            <p className={styles.modalText}>
              Una vez enviado no vas a poder editar los items hasta que vuelva a borrador.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={cerrarModal} disabled={accionando}>Cancelar</button>
              <button type="button" className={styles.btnPrimary} onClick={handleEnviar} disabled={accionando}>
                {accionando ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: volver a borrador */}
      {accion === 'volver' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>¿Volver a borrador?</h3>
            <p className={styles.modalText}>
              El presupuesto vuelve a ser editable. Podés ajustar items y reenviarlo.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={cerrarModal} disabled={accionando}>Cancelar</button>
              <button type="button" className={styles.btnPrimary} onClick={handleVolver} disabled={accionando}>
                {accionando ? 'Volviendo...' : 'Sí, volver a borrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: aprobar — copy dinámico según haya insumos o no
          (issue menor 3.2). Si solo hay costos extra, no se genera
          remito: el modal lo aclara para no confundir al operador. */}
      {accion === 'aprobar' && (() => {
        const nInsumos = presupuesto.insumos?.length || 0
        return (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCard}>
              <h3 className={styles.modalTitle}>¿Aprobar presupuesto?</h3>
              <p className={styles.modalText}>
                {nInsumos > 0 ? (
                  <>
                    Se va a generar automáticamente un remito en estado BORRADOR con
                    los <strong>{nInsumos} insumo{nInsumos !== 1 ? 's' : ''}</strong> de este presupuesto.
                    La obra pasará a estado ACTIVA.
                  </>
                ) : (
                  <>
                    Este presupuesto no tiene insumos cargados — solo costos extra.
                    Se va a marcar como APROBADO pero <strong>no se va a generar ningún remito</strong>.
                    La obra pasará a estado ACTIVA.
                  </>
                )}
              </p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={cerrarModal} disabled={accionando}>Cancelar</button>
                <button type="button" className={styles.btnPrimary} onClick={handleAprobar} disabled={accionando}>
                  {accionando ? 'Aprobando...' : 'Sí, aprobar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: rechazar (con motivo opcional) */}
      {accion === 'rechazar' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>¿Rechazar presupuesto?</h3>
            <p className={styles.modalText}>
              Anotá un motivo (opcional) para que quede registrado. Esta acción no se puede deshacer.
            </p>
            <textarea className={styles.modalTextarea} rows={3}
              placeholder="Ej. precios muy altos, falta detalle, etc."
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)} />
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={cerrarModal} disabled={accionando}>Cancelar</button>
              <button type="button" className={styles.btnDanger} onClick={handleRechazar} disabled={accionando}>
                {accionando ? 'Rechazando...' : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar */}
      {accion === 'eliminar' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>¿Eliminar presupuesto?</h3>
            <p className={styles.modalText}>
              Se elimina el presupuesto y todos sus items. Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={cerrarModal} disabled={accionando}>Cancelar</button>
              <button type="button" className={styles.btnDanger} onClick={handleEliminar} disabled={accionando}>
                {accionando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal post-aprobacion: configurar transporte + responsable
          del remito generado por la RPC. Se abre solo si aprobar()
          devolvio un remitoGeneradoId no nulo. */}
      {remitoConfigId && (
        <ConfigurarRemitoModal
          remitoId={remitoConfigId}
          onClose={() => setRemitoConfigId(null)} />
      )}
    </div>
  )
}
