// src/modules/m4-obra/pages/ObrasListPage.jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useObras } from '../hooks/useObras'
import styles from './ObrasListPage.module.css'

function formatFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// Mapeo de los 5 estados de obra a label + clase visual.
const ESTADO_INFO = {
  PENDIENTE_PRESUPUESTO: { label: '⏳ Pendiente presupuesto', cls: 'pendiente' },
  EN_APROBACION:         { label: '⏰ En aprobación',         cls: 'enAprobacion' },
  ACTIVA:                { label: '● Activa',                 cls: 'activa' },
  FINALIZADA:            { label: '✓ Finalizada',             cls: 'finalizada' },
  RECHAZADA:             { label: '✕ Rechazada',              cls: 'rechazada' },
}

// Agrupamiento por bucket: "En proceso" = estados vivos, "Historial" = terminales.
const BUCKET_EN_PROCESO = ['PENDIENTE_PRESUPUESTO', 'EN_APROBACION', 'ACTIVA']
const BUCKET_HISTORIAL  = ['FINALIZADA', 'RECHAZADA']

function EstadoBadge({ estado }) {
  const info = ESTADO_INFO[estado] || { label: estado, cls: '' }
  return <span className={`${styles.badge} ${styles[info.cls] || ''}`}>{info.label}</span>
}

function TablaObras({ obras, navigate }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cliente</th>
            <th>Dirección</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Remitos</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {obras.map(o => (
            <tr key={o.id} className={styles.row} onClick={() => navigate(`/obras/${o.id}`)}>
              <td className={styles.nombre}>{o.nombre}</td>
              <td className={styles.cliente}>{o.cliente_nombre || o.cliente || '—'}</td>
              <td className={styles.direccion}>{o.direccion}</td>
              <td className={styles.fecha}>{formatFecha(o.fecha_inicio)}</td>
              <td className={styles.fecha}>{formatFecha(o.fecha_fin)}</td>
              <td className={styles.cant}>{o.cantidad_remitos}</td>
              <td><EstadoBadge estado={o.estado} /></td>
              <td className={styles.actions}>
                <button className={styles.btnRow}
                  onClick={e => { e.stopPropagation(); navigate(`/obras/${o.id}`) }}>
                  Ver →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ObrasListPage() {
  const navigate = useNavigate()
  const [seccion,      setSeccion]      = useState('en_proceso') // en_proceso | historial
  const [filtroEstado, setFiltroEstado] = useState('TODOS')      // chip dentro del bucket
  const [busqueda,     setBusqueda]     = useState('')

  // Una sola query SIN filtros — todo el filtrado (bucket / chip /
  // busqueda) es cliente-side. Tres razones:
  //   1) Counts en chips deben reflejar TODO el bucket, no solo lo
  //      filtrado por la busqueda (issue 2.10 de auditoria).
  //   2) Evita un fetch por tecla mientras el user tipea (issue 2.11).
  //   3) Para una empresa pequeña hay decenas/cientos de obras —
  //      cliente-side va sobrado y es mas rapido (sin round-trip).
  const { obras: todas, loading, error } = useObras()

  const bucketActual = seccion === 'en_proceso' ? BUCKET_EN_PROCESO : BUCKET_HISTORIAL

  // Aplica la busqueda cliente-side. Match case-insensitive contra nombre,
  // cliente (FK o legacy text) y direccion.
  const obrasMatchBusqueda = useMemo(() => {
    if (!busqueda.trim()) return todas
    const q = busqueda.trim().toLowerCase()
    return todas.filter(o =>
      (o.nombre        || '').toLowerCase().includes(q) ||
      (o.cliente_nombre|| '').toLowerCase().includes(q) ||
      (o.cliente       || '').toLowerCase().includes(q) ||
      (o.direccion     || '').toLowerCase().includes(q)
    )
  }, [todas, busqueda])

  // Counts por estado dentro del bucket actual.
  // - Sin busqueda: count del bucket completo (set canonico).
  // - Con busqueda: count de los que matchean la busqueda + estan en el bucket
  //   (asi los chips no mienten cuando el user filtra por texto).
  const countsPorEstado = useMemo(() => {
    const map = Object.fromEntries(bucketActual.map(e => [e, 0]))
    for (const o of obrasMatchBusqueda) {
      if (map[o.estado] !== undefined) map[o.estado]++
    }
    return map
  }, [obrasMatchBusqueda, bucketActual])

  // Lista filtrada que se muestra
  const lista = useMemo(() => {
    const dentroBucket = obrasMatchBusqueda.filter(o => bucketActual.includes(o.estado))
    if (filtroEstado === 'TODOS') return dentroBucket
    return dentroBucket.filter(o => o.estado === filtroEstado)
  }, [obrasMatchBusqueda, bucketActual, filtroEstado])

  const totalBucket = obrasMatchBusqueda.filter(o => bucketActual.includes(o.estado)).length

  const cambiarSeccion = (nueva) => {
    setSeccion(nueva)
    setFiltroEstado('TODOS') // reset chip al cambiar bucket
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Obras</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${lista.length} obra${lista.length !== 1 ? 's' : ''}${filtroEstado !== 'TODOS' ? ' (filtradas)' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/obras/nueva')}>
          + Nueva obra
        </button>
      </div>

      {/* Tabs: En proceso / Historial */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${seccion === 'en_proceso' ? styles.tabActive : ''}`}
          onClick={() => cambiarSeccion('en_proceso')}>
          En proceso
          <span className={styles.tabCount}>{todas.filter(o => BUCKET_EN_PROCESO.includes(o.estado)).length}</span>
        </button>
        <button className={`${styles.tab} ${seccion === 'historial' ? styles.tabActive : ''}`}
          onClick={() => cambiarSeccion('historial')}>
          Historial
          <span className={styles.tabCount}>{todas.filter(o => BUCKET_HISTORIAL.includes(o.estado)).length}</span>
        </button>
      </div>

      {/* Chips de estado puntual dentro del bucket */}
      <div className={styles.chips}>
        <button className={`${styles.chip} ${filtroEstado === 'TODOS' ? styles.chipActive : ''}`}
          onClick={() => setFiltroEstado('TODOS')}>
          Todos
          <span className={styles.chipCount}>{totalBucket}</span>
        </button>
        {bucketActual.map(estado => (
          <button key={estado}
            className={`${styles.chip} ${filtroEstado === estado ? styles.chipActive : ''}`}
            onClick={() => setFiltroEstado(estado)}>
            {ESTADO_INFO[estado].label}
            <span className={styles.chipCount}>{countsPorEstado[estado]}</span>
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input type="search" className={styles.searchInput}
            placeholder="Buscar por nombre..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        {busqueda && (
          <button className={styles.btnGhost} onClick={() => setBusqueda('')}>Limpiar</button>
        )}
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando obras...
        </div>
      )}

      {!loading && !error && lista.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏗️</span>
          <p>
            {seccion === 'en_proceso'
              ? (filtroEstado === 'TODOS' ? 'No hay obras en proceso.' : `No hay obras en "${ESTADO_INFO[filtroEstado]?.label || filtroEstado}".`)
              : (filtroEstado === 'TODOS' ? 'No hay obras en el historial.' : `No hay obras en "${ESTADO_INFO[filtroEstado]?.label || filtroEstado}".`)}
          </p>
          {seccion === 'en_proceso' && filtroEstado === 'TODOS' && (
            <button className={styles.btnPrimary} onClick={() => navigate('/obras/nueva')}>
              Registrar primera obra
            </button>
          )}
        </div>
      )}

      {!loading && !error && lista.length > 0 && (
        <TablaObras obras={lista} navigate={navigate} />
      )}

    </div>
  )
}
