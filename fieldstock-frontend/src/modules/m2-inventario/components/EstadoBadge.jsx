// src/modules/m2-inventario/components/EstadoBadge.jsx
import styles from './EstadoBadge.module.css'

const CONFIG = {
  DISPONIBLE:      { label: 'Disponible',      cls: 'disponible'     },
  EN_OBRA:         { label: 'En obra',          cls: 'enObra'         },
  EN_MANTENIMIENTO:{ label: 'En mantenimiento', cls: 'enMantenimiento'},
  RESERVADA:       { label: 'Reservada',        cls: 'reservada'      },
  BAJA:            { label: 'Baja',             cls: 'baja'           },
}

export default function EstadoBadge({ estado }) {
  const { label, cls } = CONFIG[estado] ?? { label: estado, cls: 'disponible' }
  return <span className={`${styles.badge} ${styles[cls]}`}>{label}</span>
}
