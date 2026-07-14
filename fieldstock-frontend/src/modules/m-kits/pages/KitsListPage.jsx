// src/modules/m-kits/pages/KitsListPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { KitsService } from '../services/kits.service'
import styles from './KitsListPage.module.css'

export default function KitsListPage() {
  const navigate = useNavigate()
  const [kits,     setKits]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      KitsService.getAll({ q: busqueda || undefined })
        .then(setKits)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }, busqueda ? 300 : 0)
    return () => clearTimeout(timer)
  }, [busqueda])

  const lista = useMemo(() => kits, [kits])

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Kits</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${lista.length} kit${lista.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/kits/nuevo')}>
          + Nuevo kit
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
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando kits...
        </div>
      )}

      {!loading && !error && lista.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🧰</span>
          <p>
            {busqueda ? `Sin resultados para "${busqueda}"` : 'Todavía no hay kits armados.'}
          </p>
          {!busqueda && (
            <button className={styles.btnPrimary} onClick={() => navigate('/kits/nuevo')}>
              Armar el primer kit
            </button>
          )}
        </div>
      )}

      {!loading && !error && lista.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Herramientas</th>
                <th>Materiales</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(k => (
                <tr key={k.id} className={styles.row} onClick={() => navigate(`/kits/${k.id}`)}>
                  <td className={styles.nombre}>{k.nombre}</td>
                  <td className={styles.descripcion}>{k.descripcion || '—'}</td>
                  <td className={styles.cant}>{k.cantidadHerramientas}</td>
                  <td className={styles.cant}>{k.cantidadMateriales}</td>
                  <td className={styles.actions}>
                    <button className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); navigate(`/kits/${k.id}`) }}>
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
