// src/modules/m2-inventario/pages/InventarioDetailPage.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHerramienta } from '../hooks/useInventario'
import { InventarioService } from '../services/inventario.service'
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
  const { herramienta, movimientos, loading, error, refetch } = useHerramienta(id)

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)
  const [showBajaForm,  setShowBajaForm]  = useState(false)
  const [motivoBaja,    setMotivoBaja]    = useState('')
  const [showQR,        setShowQR]        = useState(false)

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
        </div>
      </div>
    </div>
  )
}
