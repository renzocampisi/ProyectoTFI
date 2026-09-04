// src/modules/m4-obra/pages/ObrasDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useObra } from '../hooks/useObras'
import { ObrasService } from '../services/obras.service'
import PresupuestosObraSection from '@modules/m-presupuestos/components/PresupuestosObraSection'
import EstadoRemitoBadge from '@modules/m5-remito/components/EstadoRemitoBadge'
import { ESTADO_INFO } from '../constants'
import styles from './ObrasDetailPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function EstadoBadge({ estado }) {
  // ESTADO_INFO viene de m4-obra/constants — fuente única para los 5
  // estados de obra. `cls` es el nombre de la clase, que mapeamos al
  // CSS Module local con styles[].
  const info = ESTADO_INFO[estado] ?? { label: estado, cls: '' }
  return <span className={`${styles.badge} ${styles[info.cls] || ''}`}>{info.label}</span>
}

export default function ObrasDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { obra, loading, error, refetch } = useObra(id)

  const [loadingAction, setLoadingAction] = useState(false)
  const [errAction,     setErrAction]     = useState(null)

  // Cierre de obra (Historial de Obra): datos manuales opcionales que se
  // cargan en el mismo momento de finalizar — horas hombre, inconvenientes,
  // costos no anticipados. Nada es obligatorio, se puede finalizar sin
  // cargar nada, igual que antes de esta feature.
  const [cierreModal,          setCierreModal]          = useState(false)
  const [horasHombre,          setHorasHombre]          = useState('')
  const [inconvenientes,       setInconvenientes]       = useState([])
  const [costosNoAnticipados,  setCostosNoAnticipados]  = useState([])
  const [guardandoCierre,      setGuardandoCierre]      = useState(false)

  // Herramientas reservadas para esta obra (reserva con fecha, separada del
  // estado RESERVADA transitorio de un remito en BORRADOR). Pedido aparte,
  // no bloquea el render principal.
  const [reservas, setReservas] = useState([])
  useEffect(() => {
    if (!id) return
    ObrasService.getReservas(id).then(setReservas).catch(() => setReservas([]))
  }, [id])

  const action = async (fn) => {
    setLoadingAction(true); setErrAction(null)
    try { await fn(); await refetch() }
    catch (err) { setErrAction(err.message) }
    finally { setLoadingAction(false) }
  }

  const handleReactivar = () => action(() => ObrasService.reactivar(id))

  const abrirCierre = () => {
    setHorasHombre(''); setInconvenientes([]); setCostosNoAnticipados([])
    setCierreModal(true)
  }
  const cerrarCierre = () => setCierreModal(false)

  const agregarInconveniente = () => setInconvenientes(arr => [...arr, ''])
  const actualizarInconveniente = (i, valor) => setInconvenientes(arr => arr.map((v, idx) => idx === i ? valor : v))
  const quitarInconveniente = (i) => setInconvenientes(arr => arr.filter((_, idx) => idx !== i))

  const agregarCostoNA = () => setCostosNoAnticipados(arr => [...arr, { descripcion: '', monto: '' }])
  const actualizarCostoNA = (i, campo, valor) =>
    setCostosNoAnticipados(arr => arr.map((c, idx) => idx === i ? { ...c, [campo]: valor } : c))
  const quitarCostoNA = (i) => setCostosNoAnticipados(arr => arr.filter((_, idx) => idx !== i))

  const confirmarFinalizar = async () => {
    setGuardandoCierre(true); setErrAction(null)
    try {
      await ObrasService.finalizar(id, {
        horasHombre: horasHombre.trim() ? Number(horasHombre) : undefined,
        inconvenientes: inconvenientes.filter(t => t.trim()),
        costosNoAnticipados: costosNoAnticipados
          .filter(c => c.descripcion.trim() && c.monto !== '')
          .map(c => ({ descripcion: c.descripcion, monto: Number(c.monto) })),
      })
      setCierreModal(false)
      await refetch()
    } catch (err) { setErrAction(err.message) }
    finally { setGuardandoCierre(false) }
  }

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
            {obra.estado === 'FINALIZADA' && (
              <button className={styles.btnSecondary} onClick={() => navigate(`/obras/${id}/historial`)}>
                📋 Historial
              </button>
            )}
            {esActiva ? (
              <button className={styles.btnFinalizar} onClick={abrirCierre} disabled={loadingAction}>
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

        {/* Main col: Presupuestos + Remitos asociados */}
        <div className={styles.mainCol}>
          {/* Presupuestos (parte 3 de la feature). Va arriba de remitos
              porque cronológicamente vienen primero en el flujo de obra. */}
          <PresupuestosObraSection obraId={obra.id} />

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
                        <td className={styles.fecha}>{formatFecha(r.fecha_egreso)}</td>
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

          {reservas.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                Herramientas reservadas
                <span className={styles.cardCount}>{reservas.length}</span>
              </h2>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Herramienta</th>
                      <th>Fecha reservada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map(r => (
                      <tr key={r.id} className={styles.row}
                        onClick={() => navigate(`/herramientas/${r.herramienta_id}`)}>
                        <td>{r.herramienta?.nombre}</td>
                        <td className={styles.fecha}>{formatFecha(r.fecha_reserva)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

      </div>

      {/* Cierre de obra — datos manuales opcionales del historial. Todo
          opcional: "Finalizar" sin cargar nada se comporta igual que antes. */}
      {cierreModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Finalizar obra</h3>
            <p className={styles.modalText}>
              Los datos de acá abajo son opcionales — quedan guardados en el
              historial de la obra. Podés finalizar sin cargar nada.
            </p>

            <div className={styles.campo}>
              <span className={styles.campoLabel}>Horas hombre (opcional)</span>
              <input type="number" min="0" step="any" className={styles.inputEdit}
                placeholder="Ej. 120"
                value={horasHombre} onChange={e => setHorasHombre(e.target.value)} />
            </div>

            <div className={styles.campo}>
              <span className={styles.campoLabel}>Inconvenientes</span>
              {inconvenientes.map((v, i) => (
                <div key={i} className={styles.rowAdd}>
                  <input type="text" className={styles.inputEdit} placeholder="Ej. Lluvia retrasó 3 días"
                    value={v} onChange={e => actualizarInconveniente(i, e.target.value)} />
                  <button type="button" className={styles.btnEliminarFila}
                    onClick={() => quitarInconveniente(i)} title="Quitar">🗑</button>
                </div>
              ))}
              <button type="button" className={styles.btnLink} onClick={agregarInconveniente}>
                + Agregar inconveniente
              </button>
            </div>

            <div className={styles.campo}>
              <span className={styles.campoLabel}>Costos no anticipados</span>
              {costosNoAnticipados.map((c, i) => (
                <div key={i} className={styles.rowAdd}>
                  <input type="text" className={styles.inputEdit} placeholder="Descripción"
                    value={c.descripcion} onChange={e => actualizarCostoNA(i, 'descripcion', e.target.value)} />
                  <input type="number" min="0" step="any" className={styles.inputEditNum} placeholder="Monto"
                    value={c.monto} onChange={e => actualizarCostoNA(i, 'monto', e.target.value)} />
                  <button type="button" className={styles.btnEliminarFila}
                    onClick={() => quitarCostoNA(i)} title="Quitar">🗑</button>
                </div>
              ))}
              <button type="button" className={styles.btnLink} onClick={agregarCostoNA}>
                + Agregar costo no anticipado
              </button>
            </div>

            {errAction && <div className={styles.errorBanner}>⚠ {errAction}</div>}

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={cerrarCierre} disabled={guardandoCierre}>
                Cancelar
              </button>
              <button type="button" className={styles.btnFinalizar} onClick={confirmarFinalizar} disabled={guardandoCierre}>
                {guardandoCierre ? 'Finalizando...' : 'Finalizar obra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
