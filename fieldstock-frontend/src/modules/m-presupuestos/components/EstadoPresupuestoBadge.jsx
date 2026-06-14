// src/modules/m-presupuestos/components/EstadoPresupuestoBadge.jsx
/**
 * Pill compartido para mostrar el estado de un presupuesto.
 * Usa el mapeo ESTADO_INFO de constants para mantener un solo lugar
 * con labels y colores.
 */
import { ESTADO_INFO } from '../constants'
import styles from './EstadoPresupuestoBadge.module.css'

export default function EstadoPresupuestoBadge({ estado }) {
  const info = ESTADO_INFO[estado]
  if (!info) return <span className={styles.badge}>{estado}</span>
  return <span className={`${styles.badge} ${styles[info.cls]}`}>{info.label}</span>
}
