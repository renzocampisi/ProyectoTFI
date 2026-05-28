// src/modules/m4-obra/pages/ObrasDetailPage.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useObra } from '../hooks/useObras'
import { ObrasService } from '../services/obras.service'
import styles from './ObrasDetailPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function EstadoBadge({ estado }) {
  return (
    <span className={`${styles.badge} ${estado === 'ACTIVA' ? styles.activa : styles.finalizada}`}>
      {estado === 'ACTIVA' ? '● Activa' : '✓ Finalizada'}
    </span>
  )
}

function EstadoRemitoBadge({ estado }) {
  const MAP = {
    BORRADOR:         { label: 'Borrador',        cls: 'borrador'  },
    CONFIRMADO:       { label: 'Confirmado',       cls: 'confirmado'},
    EN_TRANSITO:      { label: 'En tránsito',      cls: 'transito'  },
    RECIBIDO_EN_OBRA: { label: 'Recibido en obra', cls: 'recibido'  },
    CERRADO:          { label: 'Cerrado',          cls: 'cerrado'   },
  }
  const { label, cls } = MAP[estado] ?? { label: estado, cls: 'borrador' }
  return <span className={`${styles.remitoBadge} ${styles[cls]}`}>{label}</span>
}

export default function ObrasDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { obra, loading, error, refetch } = useObra(id)

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)

  const action = async (fn) => {
    setLoadingAction(true); setErrAction(null)
    try { await fn(); await refetch() }
    catch (err) { setErrAction(err.message) }
    finally { setLoadingAction(false) }
  }

  const handleFinalizar = () => action(() => ObrasService.finalizar(id))
  const handleReactivar = () => action(() => ObrasService.reactivar(id))

  if (loading) return (
    <div className={styles.loadingWrapper}><span className={styles.spinner} />Cargando obra...</div>
  )
  if (error || !obra) return (
    <div className={styles.noEncontrado}>
      <span>🔍</span><h2>{error || 'Obra no encontrada'}</h2>
      <button className={styles.btnGhost} onClick={() => navigate('/obras')}>← Volver</button>
    </div>
  )

  const esActiva = obra.estado === 'ACTIVA'

  return (
    <div className={styles.page}>

      {/* Encabezado */}
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => navigate('/obras')}>← Volver</button>
        <div className={styles.headerMain}>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>{obra.nombre}</h1>
            <div className={styles.headerMeta}>
              <span className={styles.cliente}>{obra.cliente_nombre || obra.cliente}</span>
              <EstadoBadge estado={obra.estado} />
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnEdit} onClick={() => navigate(`/obras/${id}/editar`)}>
              ✎ Editar
            </button>
            {esActiva ? (
              <button className={styles.btnFinalizar} onClick={handleFinalizar} disabled={loadingAction}>
                Finalizar obra
              </button>
            ) : (
              <button className={styles.btnReactivar} onClick={handleReactivar} disabled={loadingAction}>
                Reactivar
              </button>
            )}
          </div>
        </div>
      </div>

      {errAction && <div className={styles.errorBanner}>⚠ {errAction}</div>}

      <div className={styles.layout}>

        {/* Datos */}
        <div className={styles.sidebar}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Datos de la obra</h2>
            <div className={styles.campos}>
              {[
                { label: 'Nombre',    value: obra.nombre },
                { label: 'Cliente',   value: obra.cliente_nombre || obra.cliente },
                { label: 'Dirección', value: obra.direccion },
                { label: 'Inicio',    value: formatFecha(obra.fecha_inicio) },
                { label: 'Fin',       value: formatFecha(obra.fecha_fin) },
                { label: 'Remitos',   value: obra.cantidad_remitos },
              ].map(({ label, value }) => (
                <div key={label} className={styles.campo}>
                  <span className={styles.campoLabel}>{label}</span>
                  <span className={styles.campoValue}>{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Remitos asociados */}
        <div className={styles.mainCol}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                Remitos asociados
                <span className={styles.cardCount}>{obra.remitos?.length ?? 0}</span>
              </h2>
              <button className={styles.btnSecondary} onClick={() => navigate('/remitos/nuevo')}>
                + Nuevo remito
              </button>
            </div>

            {(!obra.remitos?.length) ? (
              <div className={styles.emptySection}>
                Sin remitos asociados a esta obra todavía.
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Tipo</th>
                      <th>Fecha</th>
                      <th>Herramientas</th>
                      <th>Insumos</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {obra.remitos.map(r => (
                      <tr key={r.id} className={styles.row} onClick={() => navigate(`/remitos/${r.id}`)}>
                        <td className={styles.numero}>{r.numero}</td>
                        <td>
                          <span className={`${styles.tipoBadge} ${r.tipo === 'EGRESO' ? styles.egreso : styles.ingreso}`}>
                            {r.tipo === 'EGRESO' ? '↑ Egreso' : '↓ Ingreso'}
                          </span>
                        </td>
                        <td className={styles.fecha}>{formatFecha(r.fecha)}</td>
                        <td className={styles.cant}>{r.cantidad_herramientas}</td>
                        <td className={styles.cant}>{r.cantidad_materiales}</td>
                        <td><EstadoRemitoBadge estado={r.estado} /></td>
                        <td className={styles.actions}>
                          <button className={styles.btnRow}
                            onClick={e => { e.stopPropagation(); navigate(`/remitos/${r.id}`) }}>
                            Ver →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

      </div>
    </div>
  )
}
