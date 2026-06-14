// src/modules/m-presupuestos/components/PresupuestosObraSection.jsx
/**
 * Sección de Presupuestos que se renderiza dentro de la página de una
 * obra (ObrasDetailPage). Muestra la lista de presupuestos asociados
 * con badge de estado, total y link al detalle.
 *
 * En esta parte 3 el botón "+ Nuevo presupuesto" todavía no navega a
 * ningún form (eso llega en parte 4) — queda con un placeholder.
 */
import { useNavigate } from 'react-router-dom'
import { usePresupuestos } from '../hooks/usePresupuestos'
import EstadoPresupuestoBadge from './EstadoPresupuestoBadge'
import { formatMoney, formatFecha } from '../constants'
import styles from './PresupuestosObraSection.module.css'

export default function PresupuestosObraSection({ obraId }) {
  const navigate = useNavigate()
  const { presupuestos, loading, error } = usePresupuestos({ obraId })

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          Presupuestos
          {presupuestos.length > 0 && (
            <span className={styles.cardCount}>{presupuestos.length}</span>
          )}
        </h2>
        <button className={styles.btnSecondary}
          onClick={() => navigate(`/presupuestos/nuevo?obraId=${obraId}`)}
          title="Próximamente disponible en parte 4">
          + Nuevo presupuesto
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando presupuestos...</div>
      ) : error ? (
        <div className={styles.error}>⚠ {error}</div>
      ) : presupuestos.length === 0 ? (
        <div className={styles.empty}>
          Esta obra no tiene presupuestos todavía. Cuando agregues uno aparecerá acá.
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead><tr>
              <th>Número</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th className={styles.tdNum}>Total</th>
              <th></th>
            </tr></thead>
            <tbody>
              {presupuestos.map(p => (
                <tr key={p.id} className={styles.row}
                  onClick={() => navigate(`/presupuestos/${p.id}`)}>
                  <td className={styles.numero}>{p.numero}</td>
                  <td><EstadoPresupuestoBadge estado={p.estado} /></td>
                  <td className={styles.fecha}>{formatFecha(p.fecha_creacion)}</td>
                  <td className={styles.tdNum}>{formatMoney(p.total)}</td>
                  <td className={styles.actions}>
                    <button className={styles.btnRow}
                      onClick={e => { e.stopPropagation(); navigate(`/presupuestos/${p.id}`) }}>
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
  )
}
