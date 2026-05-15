// src/modules/m2-inventario/pages/InventarioListPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventario } from '../hooks/useInventario'
import { InventarioService } from '../services/inventario.service'
import EstadoBadge from '../components/EstadoBadge'
import styles from './InventarioListPage.module.css'

const ESTADOS        = ['DISPONIBLE', 'EN_OBRA', 'EN_MANTENIMIENTO', 'RESERVADA', 'BAJA']
const FILTROS_ESTADO = ['TODOS', ...ESTADOS]

export default function InventarioListPage() {
  const navigate = useNavigate()
  const [categorias, setCategorias] = useState([])

  const {
    herramientas,
    loading,
    error,
    conteos,
    busqueda,        setBusqueda,
    filtroEstado,    setFiltroEstado,
    filtroCategoria, setFiltroCategoria,
  } = useInventario()

  useEffect(() => {
    InventarioService.getCategorias().then(setCategorias).catch(() => {})
  }, [])

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Herramientas</h1>
          <p className={styles.subtitle}>
            {loading ? 'Cargando...' : `${herramientas.length} herramienta${herramientas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/herramientas/nuevo')}>
          + Registrar herramienta
        </button>
      </div>

      <div className={styles.estadoChips}>
        {FILTROS_ESTADO.map(estado => (
          <button
            key={estado}
            className={`${styles.chip} ${filtroEstado === estado ? styles.chipActive : ''}`}
            onClick={() => setFiltroEstado(estado)}
          >
            {estado === 'TODOS' ? 'Todos' : estado.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
            <span className={styles.chipCount}>{conteos[estado] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nombre, QR o categoría..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className={styles.select}
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="TODAS">Todas las categorías</option>
          {categorias.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      {error && <div className={styles.errorBanner}>⚠ No se pudo conectar con el servidor: {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />
          <span>Cargando herramientas...</span>
        </div>
      )}

      {!loading && !error && herramientas.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔍</span>
          <p>No se encontraron herramientas.</p>
          <button
            className={styles.btnGhost}
            onClick={() => { setBusqueda(''); setFiltroEstado('TODOS'); setFiltroCategoria('TODAS') }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {!loading && !error && herramientas.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Herramienta</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Código QR</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {herramientas.map(h => (
                <tr
                  key={h.id}
                  className={styles.row}
                  onClick={() => navigate(`/herramientas/${h.id}`)}
                >
                  <td className={styles.nombre}>{h.nombre}</td>
                  <td className={styles.categoria}>{h.categoria_nombre}</td>
                  <td><EstadoBadge estado={h.estado} /></td>
                  <td className={styles.qr}>{h.codigo_qr}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); navigate(`/herramientas/${h.id}`) }}
                    >
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
