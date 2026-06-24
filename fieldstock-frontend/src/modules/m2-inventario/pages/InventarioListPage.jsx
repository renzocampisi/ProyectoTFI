// src/modules/m2-inventario/pages/InventarioListPage.jsx
import { useNavigate } from 'react-router-dom'
import { useInventario } from '../hooks/useInventario'
import { CATEGORIAS, ESTADOS } from '../services/inventario.mock'
import EstadoBadge from '../components/EstadoBadge'
import styles from './InventarioListPage.module.css'

// Colores del punto de estado (solo visible en mobile via CSS)
const COLOR_ESTADO = {
  DISPONIBLE:       styles.dotDisponible,
  EN_OBRA:          styles.dotEnObra,
  EN_MANTENIMIENTO: styles.dotMantenimiento,
  RESERVADA:        styles.dotReservada,
  BAJA:             styles.dotBaja,
}

const FILTROS_ESTADO = ['TODOS', ...ESTADOS]

export default function InventarioListPage() {
  const navigate = useNavigate()
  const {
    herramientas,
    conteos,
    busqueda,        setBusqueda,
    filtroEstado,    setFiltroEstado,
    filtroCategoria, setFiltroCategoria,
  } = useInventario()

  return (
    <div className={styles.page}>

      {/* Encabezado con título y botón nueva herramienta */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventario</h1>
          <p className={styles.subtitle}>
            {herramientas.length} herramienta{herramientas.length !== 1 ? 's' : ''}
            {filtroEstado !== 'TODOS' || busqueda ? ' encontradas' : ' en total'}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/herramientas/nuevo')}>
          + Registrar herramienta
        </button>
      </div>

      {/* Chips de filtro por estado */}
      <div className={styles.estadoChips}>
        {FILTROS_ESTADO.map(estado => (
          <button
            key={estado}
            className={`${styles.chip} ${filtroEstado === estado ? styles.chipActive : ''}`}
            onClick={() => setFiltroEstado(estado)}
          >
            {estado === 'TODOS'
              ? 'Todos'
              : estado.replace('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
            <span className={styles.chipCount}>{conteos[estado] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Barra de búsqueda y filtro de categoría */}
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
          {CATEGORIAS.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      {/* Estado vacío */}
      {herramientas.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔍</span>
          <p>No se encontraron herramientas con ese criterio.</p>
          <button
            className={styles.btnGhost}
            onClick={() => { setBusqueda(''); setFiltroEstado('TODOS'); setFiltroCategoria('TODAS') }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Herramienta</th>
                <th>Marca</th>
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
                  {/* Nombre con punto de color (el punto solo aparece en mobile via CSS) */}
                  <td className={styles.nombre}>
                    <span
                      className={`${styles.estadoDot} ${COLOR_ESTADO[h.estado] || ''}`}
                      title={h.estado}
                    />
                    {h.nombre}
                    {h.importante && (
                      <span className={styles.importanteIcon} title="Importante — lleva rastreador GPS">
                        ⭐
                      </span>
                    )}
                  </td>

                  <td data-label="Marca">
                    {h.marca || <span className={styles.dash}>—</span>}
                  </td>

                  {/* data-label se usa en mobile para mostrar la etiqueta del campo */}
                  <td className={styles.categoria} data-label="Categoría">
                    {h.categoria_nombre || '—'}
                  </td>

                  {/* Badge de estado — se oculta en mobile, reemplazado por el punto */}
                  <td className={styles.estadoBadge} data-label="Estado">
                    <EstadoBadge estado={h.estado} />
                  </td>

                  <td className={styles.qr} data-label="Código QR">
                    {h.codigo_qr || '—'}
                  </td>

                  <td className={styles.actions}>
                    <button
                      className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); navigate(`/herramientas/${h.id}`) }}
                      title="Ver detalle"
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
