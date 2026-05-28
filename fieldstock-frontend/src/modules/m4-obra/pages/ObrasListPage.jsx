// src/modules/m4-obra/pages/ObrasListPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useObras } from '../hooks/useObras'
import styles from './ObrasListPage.module.css'

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
              {/* cliente_nombre viene del FK (post-normalización); el texto
                  legacy queda como fallback para obras no editadas. */}
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
  const [seccion,  setSeccion]  = useState('activas')
  const [busqueda, setBusqueda] = useState('')

  const { obras: activas,     loading: loadingA, error: errorA } = useObras({ estado: 'ACTIVA',     q: busqueda || undefined })
  const { obras: finalizadas, loading: loadingF, error: errorF } = useObras({ estado: 'FINALIZADA', q: busqueda || undefined })

  const loading = seccion === 'activas' ? loadingA : loadingF
  const error   = seccion === 'activas' ? errorA   : errorF
  const lista   = seccion === 'activas' ? activas   : finalizadas

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Obras</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${lista.length} obra${lista.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/obras/nueva')}>
          + Nueva obra
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${seccion === 'activas' ? styles.tabActive : ''}`}
          onClick={() => setSeccion('activas')}>
          Activas
          {!loadingA && <span className={styles.tabCount}>{activas.length}</span>}
        </button>
        <button className={`${styles.tab} ${seccion === 'finalizadas' ? styles.tabActive : ''}`}
          onClick={() => setSeccion('finalizadas')}>
          Historial
          {!loadingF && <span className={styles.tabCount}>{finalizadas.length}</span>}
        </button>
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
          <p>{seccion === 'activas' ? 'No hay obras activas.' : 'No hay obras en el historial.'}</p>
          {seccion === 'activas' && (
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
