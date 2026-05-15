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

export default function ObrasListPage() {
  const navigate = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda,     setBusqueda]     = useState('')

  const { obras, loading, error } = useObras({
    estado: filtroEstado || undefined,
    q:      busqueda     || undefined,
  })

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Obras</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${obras.length} obra${obras.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/obras/nueva')}>
          + Nueva obra
        </button>
      </div>

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
        <select className={styles.select} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todas</option>
          <option value="ACTIVA">Activas</option>
          <option value="FINALIZADA">Finalizadas</option>
        </select>
        {(filtroEstado || busqueda) && (
          <button className={styles.btnGhost} onClick={() => { setFiltroEstado(''); setBusqueda('') }}>
            Limpiar
          </button>
        )}
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando obras...
        </div>
      )}

      {!loading && !error && obras.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏗️</span>
          <p>{busqueda ? 'No se encontraron obras.' : 'No hay obras registradas todavía.'}</p>
          {!busqueda && (
            <button className={styles.btnPrimary} onClick={() => navigate('/obras/nueva')}>
              Registrar primera obra
            </button>
          )}
        </div>
      )}

      {!loading && !error && obras.length > 0 && (
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
                  <td className={styles.cliente}>{o.cliente}</td>
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
      )}

    </div>
  )
}
