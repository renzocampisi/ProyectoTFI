// src/modules/m5-remito/components/EstadoRemitoBadge.jsx
import styles from './EstadoRemitoBadge.module.css'

const CONFIG = {
  BORRADOR:            { label: 'Borrador',              cls: 'borrador'   },
  CONFIRMADO:          { label: 'Confirmado',            cls: 'confirmado' },
  EN_TRANSITO:         { label: 'En tránsito',           cls: 'transito'   },
  EN_OBRA:             { label: 'En obra',               cls: 'enObra'     },
  EN_RETORNO:          { label: 'En retorno',            cls: 'retorno'    },
  EN_TRANSITO_RETORNO: { label: 'Volviendo',             cls: 'volviendo'  },
  CERRADO:             { label: 'Cerrado',               cls: 'cerrado'    },
}

export default function EstadoRemitoBadge({ estado }) {
  const { label, cls } = CONFIG[estado] ?? { label: estado, cls: 'borrador' }
  return <span className={`${styles.badge} ${styles[cls]}`}>{label}</span>
}
