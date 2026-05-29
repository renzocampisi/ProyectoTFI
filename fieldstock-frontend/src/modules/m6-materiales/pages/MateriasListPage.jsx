// src/modules/m6-materiales/pages/MateriasListPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMateriales } from '../hooks/useMateriales'
import MaterialDetalleModal from '../components/MaterialDetalleModal'
import AgregarStockModal from '../components/AgregarStockModal'
import styles from './MateriasListPage.module.css'

// Badge de texto para desktop/tablet
function StockBadge({ actual, minimo }) {
  if (actual === 0) return <span className={`${styles.stockBadge} ${styles.agotado}`}>Agotado</span>
  if (actual <= minimo) return <span className={`${styles.stockBadge} ${styles.bajo}`}>Stock bajo</span>
  return <span className={`${styles.stockBadge} ${styles.ok}`}>OK</span>
}

// Clase del punto de color según stock (solo visible en mobile via CSS)
function clasesPunto(actual, minimo) {
  if (actual === 0)       return styles.dotAgotado
  if (actual <= minimo)   return styles.dotBajo
  return styles.dotOk
}

export default function MateriasListPage() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  // Material a mostrar en el modal de detalle. null = modal cerrado (Word #19).
  const [materialDetalle, setMaterialDetalle] = useState(null)
  // Material al que sumarle stock vía el modal dedicado (Word A).
  // Es independiente del modal de detalle — un material puede estar en uno
  // o en el otro, no en ambos al mismo tiempo.
  const [materialStock,   setMaterialStock]   = useState(null)
  const { materiales, loading, error, refetch } = useMateriales({ q: busqueda || undefined })

  return (
    <div className={styles.page}>

      {/* Encabezado */}
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

      {/* Alerta de stock bajo — solo si hay al menos uno */}
      {!loading && materiales.some(m => m.stock_actual <= m.stock_minimo) && (
        <div className={styles.alertaBanner}>
          ⚠ Hay materiales con stock bajo o agotado.
        </div>
      )}

      {/* Buscador */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nombre o marca..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {loading && (
        <div className={styles.loadingWrapper}>
          <span className={styles.spinner} />Cargando materiales...
        </div>
      )}

      {/* Estado vacío */}
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

      {/* Tabla */}
      {!loading && !error && materiales.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Unidad</th>
                <th>Stock actual</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materiales.map(m => (
                <tr
                  key={m.id}
                  /* Fondo suave amarillo si está en alerta */
                  className={`${styles.row} ${m.stock_actual <= m.stock_minimo ? styles.rowAlerta : ''}`}
                  onClick={() => setMaterialDetalle(m)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Nombre con punto de color (visible solo en mobile) */}
                  <td className={styles.nombre}>
                    <span
                      className={`${styles.estadoDot} ${clasesPunto(m.stock_actual, m.stock_minimo)}`}
                      title={m.stock_actual === 0 ? 'Agotado' : m.stock_actual <= m.stock_minimo ? 'Stock bajo' : 'OK'}
                    />
                    {m.nombre}
                  </td>

                  {/* Marca (Word: redundancia visual cuando hay mismo nombre con
                      distinta marca tras el fix de duplicados). Si no tiene
                      marca cargada mostramos '—' en tono apagado para que la
                      celda no quede vacía. */}
                  <td className={styles.marca} data-label="Marca">
                    {m.marca || <span className={styles.marcaVacia}>—</span>}
                  </td>

                  <td className={styles.unidad} data-label="Unidad">{m.unidad}</td>
                  <td className={styles.stock}  data-label="Stock actual">{m.stock_actual}</td>
                  <td className={styles.stock}  data-label="Stock mínimo">{m.stock_minimo}</td>

                  {/* Badge de texto — se oculta en mobile, reemplazado por el punto */}
                  <td className={styles.badgeCell} data-label="Estado">
                    <StockBadge actual={m.stock_actual} minimo={m.stock_minimo} />
                  </td>

                  {/* Acciones: agregar stock (Word A) + detalle (Word #19).
                      stopPropagation para que el click no dispare el modal
                      de detalle al mismo tiempo. */}
                  <td className={styles.actions}>
                    <button
                      className={styles.btnStock}
                      onClick={e => { e.stopPropagation(); setMaterialStock(m) }}
                      title="Agregar stock a este material">
                      + Stock
                    </button>
                    <button
                      className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); setMaterialDetalle(m) }}
                      title="Ver detalle"
                    >
                      Detalle →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalle (Word #19) — se monta solo cuando hay material seleccionado */}
      {materialDetalle && (
        <MaterialDetalleModal
          material={materialDetalle}
          onClose={() => setMaterialDetalle(null)}
          onDeleted={refetch}
        />
      )}

      {/* Modal "Agregar stock" (Word A) — flujo dedicado desde la lista,
          sin tener que pasar por "Nuevo material". */}
      {materialStock && (
        <AgregarStockModal
          material={materialStock}
          onClose={() => setMaterialStock(null)}
          onSuccess={() => { setMaterialStock(null); refetch() }}
        />
      )}

    </div>
  )
}
