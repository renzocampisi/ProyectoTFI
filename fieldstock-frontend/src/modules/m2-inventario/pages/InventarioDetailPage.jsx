// src/modules/m2-inventario/pages/InventarioDetailPage.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHerramienta } from '../hooks/useInventario'
import { InventarioService } from '../services/inventario.service'
import { ObrasService } from '@modules/m4-obra/services/obras.service'
import EstadoBadge from '../components/EstadoBadge'
import QRModal from '@modules/m3-qr/components/QRModal'
import MarcaLogo from '@shared/components/MarcaLogo'
import styles from './InventarioDetailPage.module.css'

const TIPO_MOVIMIENTO = {
  EGRESO:        { label: 'Egreso a obra',  cls: 'egreso',        icon: '↑' },
  INGRESO:       { label: 'Ingreso',         cls: 'ingreso',       icon: '↓' },
  MANTENIMIENTO: { label: 'Mantenimiento',   cls: 'mantenimiento', icon: '⚙' },
}

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatValor(v) {
  if (!v) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)
}

// Comparación de solo fecha (sin hora) — timezone-safe, mismo criterio que
// formatFecha: partir el string ISO en vez de instanciar un Date.
function garantiaVencida(fechaGarantia) {
  const hoy = new Date().toISOString().split('T')[0]
  return fechaGarantia.split('T')[0] < hoy
}

function Campo({ label, value }) {
  return (
    <div className={styles.campo}>
      <span className={styles.campoLabel}>{label}</span>
      <span className={styles.campoValue}>{value ?? '—'}</span>
    </div>
  )
}

export default function InventarioDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { herramienta, movimientos, reservas, loading, error, refetch } = useHerramienta(id)

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)
  const [showBajaForm,  setShowBajaForm]  = useState(false)
  const [motivoBaja,    setMotivoBaja]    = useState('')
  const [showQR,        setShowQR]        = useState(false)

  // Reserva con fecha atada a obra (separado del estado RESERVADA transitorio
  // de un remito en BORRADOR — ver reservas.service.js del backend).
  const [showReservaForm, setShowReservaForm] = useState(false)
  const [obras,           setObras]           = useState(null) // null = sin cargar todavía
  const [obraIdReserva,   setObraIdReserva]   = useState('')
  const [fechaReserva,    setFechaReserva]    = useState('')
  const [loadingReserva,  setLoadingReserva]  = useState(false)
  const [errReserva,      setErrReserva]      = useState(null)

  const action = async (fn) => {
    setLoadingAction(true); setErrAction(null)
    try { await fn(); await refetch() }
    catch (err) { setErrAction(err.message) }
    finally { setLoadingAction(false) }
  }

  const handleBaja = () =>
    action(async () => {
      await InventarioService.darDeBaja(id, motivoBaja)
      setShowBajaForm(false)
      setMotivoBaja('')
    })

  const handleReactivar = () =>
    action(() => InventarioService.reactivar(id))

  // Abre el form de reserva y trae la lista de obras (lazy, solo la primera
  // vez que se abre — no hace falta recargarla en cada click).
  const handleAbrirReservaForm = async () => {
    setShowReservaForm(true)
    setErrReserva(null)
    if (obras === null) {
      try {
        const data = await ObrasService.getAll({ estado: 'ACTIVA' })
        setObras(data)
      } catch (err) {
        setErrReserva(err.message)
        setObras([])
      }
    }
  }

  // Al elegir una obra, la fecha default es su inicio ("podría estar atada
  // al inicio de la obra") — el usuario puede pisarla si necesita otra fecha.
  const handleSeleccionarObra = (nuevoObraId) => {
    setObraIdReserva(nuevoObraId)
    const obra = obras?.find(o => o.id === nuevoObraId)
    if (obra?.fecha_inicio) setFechaReserva(obra.fecha_inicio.split('T')[0])
  }

  const handleCrearReserva = async () => {
    if (!obraIdReserva || !fechaReserva) return
    setLoadingReserva(true); setErrReserva(null)
    try {
      await InventarioService.crearReserva(id, { obraId: obraIdReserva, fechaReserva })
      setShowReservaForm(false)
      setObraIdReserva('')
      setFechaReserva('')
      await refetch()
    } catch (err) {
      setErrReserva(err.message)
    } finally {
      setLoadingReserva(false)
    }
  }

  const handleEliminarReserva = (reservaId) =>
    action(() => InventarioService.eliminarReserva(id, reservaId))

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando herramienta...</div>
  )

  if (error || !herramienta) return (
    <div className={styles.noEncontrado}>
      <span className={styles.noEncontradoIcon}>🔍</span>
      <h2>{error || 'Herramienta no encontrada'}</h2>
      <button className={styles.btnGhost} onClick={() => navigate('/herramientas')}>← Volver</button>
    </div>
  )

  const esBaja = herramienta.estado === 'BAJA'

  return (
    <div className={styles.page}>

      {/* Modal QR */}
      {showQR && (
        <QRModal herramienta={herramienta} onClose={() => setShowQR(false)} />
      )}

      {/* Encabezado */}
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/herramientas')}>← Volver</button>
        <div className={styles.headerMain}>
          <div className={styles.headerInfo} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
            <MarcaLogo marca={herramienta.marca} size={72} />
            <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className={styles.title}>{herramienta.nombre}</h1>
            <div className={styles.headerMeta}>
              <span className={styles.categoria}>{herramienta.categoria_nombre}</span>
              <EstadoBadge estado={herramienta.estado} />
              {herramienta.importante && (
                <span className={styles.importanteBadge} title="Lleva rastreador GPS">
                  ⭐ Importante
                </span>
              )}
              {esBaja && herramienta.fecha_eliminacion && (
                <span className={styles.eliminacionWarning}>
                  ⚠ Se elimina el {formatFecha(herramienta.fecha_eliminacion)}
                </span>
              )}
            </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            {/* Botón QR */}
            <button className={styles.btnQR} onClick={() => setShowQR(true)} title="Ver código QR">
              ⬛ Ver QR
            </button>
            {!esBaja && (
              <button className={styles.btnEdit} onClick={() => navigate(`/herramientas/${id}/editar`)}>
                ✎ Editar
              </button>
            )}
            {!esBaja ? (
              <button className={styles.btnBaja} onClick={() => setShowBajaForm(true)} disabled={loadingAction}>
                Dar de baja
              </button>
            ) : (
              <button className={styles.btnReactivar} onClick={handleReactivar} disabled={loadingAction}>
                Reactivar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Formulario de baja */}
      {showBajaForm && (
        <div className={styles.bajaForm}>
          <p className={styles.bajaFormTitle}>
            ⚠ La herramienta pasará a estado <strong>BAJA</strong> y se eliminará automáticamente en 1 año.
          </p>
          <div className={styles.bajaFormRow}>
            <input type="text" className={styles.bajaInput}
              placeholder="Motivo de baja (opcional)"
              value={motivoBaja} onChange={e => setMotivoBaja(e.target.value)} />
            <button className={styles.btnBajaConfirm} onClick={handleBaja} disabled={loadingAction}>
              {loadingAction ? 'Procesando...' : 'Confirmar baja'}
            </button>
            <button className={styles.btnCancelar} onClick={() => { setShowBajaForm(false); setMotivoBaja('') }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {esBaja && herramienta.motivo_baja && (
        <div className={styles.bajaInfo}>
          <span className={styles.bajaInfoLabel}>Motivo de baja:</span>
          <span>{herramienta.motivo_baja}</span>
        </div>
      )}

      {errAction && <div className={styles.errorBanner}>⚠ {errAction}</div>}

      <div className={styles.layout}>
        <div className={styles.columnaIzq}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Identificación</h2>
            <div className={styles.campos}>
              <Campo label="Marca"           value={herramienta.marca} />
              <Campo label="Modelo"          value={herramienta.modelo} />
              <Campo label="Número de serie" value={herramienta.numero_serie} />
              <Campo label="Categoría"       value={herramienta.categoria_nombre} />
              <Campo label="Código QR"       value={herramienta.codigo_qr} />
              <Campo
                label="Importancia"
                value={herramienta.importante ? '⭐ Importante (lleva rastreador GPS)' : 'Normal'}
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Datos de compra</h2>
            <div className={styles.campos}>
              <Campo label="Año de compra" value={herramienta.anio_compra} />
              <Campo label="Valor"         value={formatValor(herramienta.valor)} />
              <Campo
                label="Vencimiento de garantía"
                value={herramienta.fecha_garantia ? (
                  <span className={garantiaVencida(herramienta.fecha_garantia) ? styles.garantiaVencida : undefined}>
                    {formatFecha(herramienta.fecha_garantia)}
                    {garantiaVencida(herramienta.fecha_garantia) && ' ⚠ vencida'}
                  </span>
                ) : null}
              />
            </div>
          </section>

          {herramienta.descripcion && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Observaciones</h2>
              <p className={styles.descripcion}>{herramienta.descripcion}</p>
            </section>
          )}
        </div>

        <div className={styles.columnaDer}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Historial de movimientos
              <span className={styles.cardCount}>{movimientos.length}</span>
            </h2>
            {movimientos.length === 0 ? (
              <div className={styles.sinMovimientos}>Sin movimientos registrados.</div>
            ) : (
              <ol className={styles.timeline}>
                {movimientos.map((mov, idx) => {
                  const cfg = TIPO_MOVIMIENTO[mov.tipo] ?? { label: mov.tipo, cls: 'ingreso', icon: '•' }
                  return (
                    <li key={mov.id} className={styles.timelineItem}>
                      <div className={`${styles.timelineIcon} ${styles[cfg.cls]}`}>{cfg.icon}</div>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineHeader}>
                          <span className={`${styles.timelineTipo} ${styles[cfg.cls]}`}>{cfg.label}</span>
                          <span className={styles.timelineFecha}>{formatFecha(mov.fecha)}</span>
                        </div>
                        {mov.obra && <span className={styles.timelineObra}>{mov.obra}</span>}
                        <span className={styles.timelineResp}>Responsable: {mov.responsable}</span>
                        {mov.observacion && <span className={styles.timelineObs}>{mov.observacion}</span>}
                      </div>
                      {idx < movimientos.length - 1 && <div className={styles.timelineLine} />}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                Reservas
                <span className={styles.cardCount}>{reservas.length}</span>
              </h2>
              {!esBaja && !showReservaForm && (
                <button className={styles.btnSecondary} onClick={handleAbrirReservaForm}>
                  + Reservar
                </button>
              )}
            </div>

            {showReservaForm && (
              <div className={styles.reservaForm}>
                <select
                  className={styles.reservaSelect}
                  value={obraIdReserva}
                  onChange={e => handleSeleccionarObra(e.target.value)}
                  disabled={obras === null}
                >
                  <option value="">
                    {obras === null ? 'Cargando obras...' : 'Elegí una obra'}
                  </option>
                  {(obras || []).map(o => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className={styles.reservaFecha}
                  value={fechaReserva}
                  onChange={e => setFechaReserva(e.target.value)}
                />
                {errReserva && <div className={styles.errorBanner}>⚠ {errReserva}</div>}
                <div className={styles.reservaFormBotones}>
                  <button className={styles.btnCancelar}
                    onClick={() => { setShowReservaForm(false); setErrReserva(null) }}>
                    Cancelar
                  </button>
                  <button className={styles.btnBajaConfirm}
                    onClick={handleCrearReserva}
                    disabled={loadingReserva || !obraIdReserva || !fechaReserva}>
                    {loadingReserva ? 'Guardando...' : 'Confirmar reserva'}
                  </button>
                </div>
              </div>
            )}

            {reservas.length === 0 ? (
              <div className={styles.sinMovimientos}>Sin reservas registradas.</div>
            ) : (
              <ul className={styles.reservaLista}>
                {reservas.map(r => (
                  <li key={r.id} className={styles.reservaItem}>
                    <div>
                      <span className={styles.reservaObra}>{r.obra?.nombre}</span>
                      <span className={styles.reservaFechaTexto}>{formatFecha(r.fecha_reserva)}</span>
                    </div>
                    <button className={styles.btnReservaEliminar}
                      onClick={() => handleEliminarReserva(r.id)}
                      disabled={loadingAction}
                      title="Eliminar reserva">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
