// src/shared/components/SuscripcionBanner.jsx
/**
 * Banner persistente en toda la app cuando la suscripción necesita
 * atención (prueba por terminar, o pago vencido dentro del período de
 * gracia). Si está BLOQUEADA no se muestra acá — AppLayout corta el
 * acceso entero y redirige a /facturacion en ese caso.
 *
 * Recibe `suscripcion` por prop (en vez de pedirla ella misma) para que
 * AppLayout la traiga una sola vez y la comparta con el chequeo de bloqueo.
 */
import { useNavigate } from 'react-router-dom'
import styles from './SuscripcionBanner.module.css'

export default function SuscripcionBanner({ suscripcion }) {
  const navigate = useNavigate()

  if (!suscripcion) return null
  const estado = suscripcion.estadoEfectivo

  if (estado === 'PRUEBA') {
    return (
      <div className={`${styles.banner} ${styles.info}`}>
        <span>
          Te quedan <strong>{suscripcion.diasRestantesPrueba}</strong> día{suscripcion.diasRestantesPrueba === 1 ? '' : 's'} de prueba gratuita.
        </span>
        <button className={styles.link} onClick={() => navigate('/facturacion')}>Elegir un plan →</button>
      </div>
    )
  }

  if (estado === 'VENCIDA') {
    return (
      <div className={`${styles.banner} ${styles.warn}`}>
        <span>⚠ Hubo un problema con el último cobro de la suscripción.</span>
        <button className={styles.link} onClick={() => navigate('/facturacion')}>Regularizar pago →</button>
      </div>
    )
  }

  return null
}
