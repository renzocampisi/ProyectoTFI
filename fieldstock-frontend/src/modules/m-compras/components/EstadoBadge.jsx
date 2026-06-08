// src/modules/m-compras/components/EstadoBadge.jsx
/**
 * Badge de estado de una compra. Usa el mapping centralizado en
 * `constants.ESTADO_INFO` para que list y detail muestren lo mismo.
 *
 * Si el estado no está en el mapping (caso edge — DB con estado nuevo
 * que el frontend no conoce todavía), lo muestra crudo con estilo base.
 */
import { ESTADO_INFO } from '../constants'
import styles from './EstadoBadge.module.css'

export default function EstadoBadge({ estado }) {
  const info = ESTADO_INFO[estado]
  if (!info) return <span className={styles.badge}>{estado}</span>
  return <span className={`${styles.badge} ${styles[info.clsKey]}`}>{info.label}</span>
}
