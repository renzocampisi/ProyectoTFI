// src/modules/m5-remito/components/EstadoRemitoBadge.jsx
import styles from './EstadoRemitoBadge.module.css'

const CONFIG = {
  BORRADOR:         { label: 'Borrador',          cls: 'borrador'       },
  CONFIRMADO:       { label: 'Confirmado',         cls: 'confirmado'     },
  EN_TRANSITO:      { label: 'En tránsito',        cls: 'enTransito'     },
  RECIBIDO_EN_OBRA: { label: 'Recibido en obra',   cls: 'recibido'       },
  CERRADO:          { label: 'Cerrado',            cls: 'cerrado'        },
}

export default function EstadoRemitoBadge({ estado }) {
  const { label, cls } = CONFIG[estado] ?? { label: estado, cls: 'borrador' }
  return <span className={`${styles.badge} ${styles[cls]}`}>{label}</span>
}
