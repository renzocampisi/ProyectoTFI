// src/modules/m6-materiales/pages/MateriasListPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMateriales } from '../hooks/useMateriales'
import styles from './MateriasListPage.module.css'

function StockBadge({ actual, minimo }) {
  const agotado = actual === 0
  const bajo    = actual <= minimo
  if (agotado) return <span className={`${styles.stockBadge} ${styles.agotado}`}>Agotado</span>
  if (bajo)    return <span className={`${styles.stockBadge} ${styles.bajo}`}>Stock bajo</span>
  return             <span className={`${styles.stockBadge} ${styles.ok}`}>OK</span>
}

export default function MateriasListPage() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const { materiales, loading, error } = useMateriales({ q: busqueda || undefined })

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Materiales e insumos</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${materiales.length} material${materiales.length !== 1 ? 'es' : ''} en catálogo`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/materiales/nuevo')}>
          + Nuevo material
        </button>
      </div>

      {!loading && materiales.some(m => m.stock_actual <= m.stock_minimo) && (
        <div className={styles.alertaBanner}>
          ⚠ Hay materiales con stock bajo o agotado.
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input type="search" className={styles.searchInput}
            placeholder="Buscar material..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando materiales...
        </div>
      )}

      {!loading && !error && materiales.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📦</span>
          <p>{busqueda ? 'No se encontraron materiales.' : 'No hay materiales en el catálogo todavía.'}</p>
          {!busqueda && (
            <button className={styles.btnPrimary} onClick={() => navigate('/materiales/nuevo')}>
              Agregar primer material
            </button>
          )}
        </div>
      )}

      {!loading && !error && materiales.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Stock actual</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materiales.map(m => (
                <tr key={m.id} className={`${styles.row} ${m.stock_actual <= m.stock_minimo ? styles.rowAlerta : ''}`}>
                  <td className={styles.nombre}>{m.nombre}</td>
                  <td className={styles.unidad}>{m.unidad}</td>
                  <td className={styles.stock}>{m.stock_actual}</td>
                  <td className={styles.stock}>{m.stock_minimo}</td>
                  <td><StockBadge actual={m.stock_actual} minimo={m.stock_minimo} /></td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnEditar}
                      onClick={() => navigate(`/materiales/${m.id}/editar`)}
                    >
                      ✎ Editar
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
