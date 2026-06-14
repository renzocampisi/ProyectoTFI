// src/modules/m-presupuestos/pages/PresupuestoDetailPage.jsx
/**
 * Página de detalle del presupuesto. Por ahora **read-only** — el form
 * de edición de cabecera/items + las acciones (enviar/aprobar/rechazar/
 * PDF) vienen en partes 4-5 de la feature.
 *
 * Layout:
 *   - Header con número, badge de estado, link a la obra, total grande.
 *   - Card "Datos generales": observaciones, %ganancia, fechas.
 *   - Card "Insumos": tabla con material/cantidad/precio/subtotal.
 *   - Card "Costos extra": tabla agrupada por categoria.
 *   - Card "Totales": breakdown subtotales + ganancia + total final.
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { LuDownload } from 'react-icons/lu'
import { usePresupuesto } from '../hooks/usePresupuestos'
import { PresupuestosService } from '../services/presupuestos.service'
import EstadoPresupuestoBadge from '../components/EstadoPresupuestoBadge'
import { descargarPdfPresupuesto } from '../utils/pdfGenerator'
import { useAuth } from '@shared/hooks/useAuth'
import { esDueño } from '@shared/constants/roles'
import {
  CATEGORIA_INFO, formatMoney, formatCantidad, formatFechaHora,
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
  const handleAprobar   = () => ejecutar(() => PresupuestosService.aprobar(id))
  const handleRechazar  = () => ejecutar(() => PresupuestosService.rechazar(id, motivoRechazo))
  const handleEliminar  = () => ejecutar(
    () => PresupuestosService.remove(id),
    { redirectAfter: presupuesto?.obra?.id ? `/obras/${presupuesto.obra.id}` : '/obras' }
  )

  const handleDescargarPdf = () => {
    if (!presupuesto) return
    descargarPdfPresupuesto(presupuesto)
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
            <button type="button" className={styles.btnPdf} onClick={handleDescargarPdf}>
              <LuDownload size={14} /> Descargar PDF
            </button>
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
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Costos extra
          <span className={styles.cardCount}>{presupuesto.costos?.length ?? 0}</span>
        </h2>
        {(!presupuesto.costos?.length) ? (
          <div className={styles.empty}>Sin costos extra cargados.</div>
        ) : (
          Object.entries(costosPorCategoria).map(([cat, items]) => (
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
                  </tr></thead>
                  <tbody>
                    {items.map(c => (
                      <tr key={c.id}>
                        <td>{c.descripcion}</td>
                        <td className={styles.tdNum}>{formatCantidad(c.cantidad)}</td>
                        <td>{c.unidad || '—'}</td>
                        <td className={styles.tdNum}>{formatMoney(c.costo_unitario)}</td>
                        <td className={styles.tdNum}>{formatMoney(c.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

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
            <span>+ Costos extra (sin markup)</span>
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

      {/* Modal: aprobar */}
      {accion === 'aprobar' && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>¿Aprobar presupuesto?</h3>
            <p className={styles.modalText}>
              Se va a generar automáticamente un remito en estado BORRADOR con
              los <strong>{presupuesto.insumos?.length || 0} insumo(s)</strong> de este presupuesto.
              La obra pasará a estado ACTIVA.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={cerrarModal} disabled={accionando}>Cancelar</button>
              <button type="button" className={styles.btnPrimary} onClick={handleAprobar} disabled={accionando}>
                {accionando ? 'Aprobando...' : 'Sí, aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
