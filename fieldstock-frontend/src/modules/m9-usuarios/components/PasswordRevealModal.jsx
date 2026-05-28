// src/modules/m9-usuarios/components/PasswordRevealModal.jsx
/**
 * Modal de éxito post-creación de usuario. Muestra la password generada
 * UNA SOLA VEZ con botón "Copiar al portapapeles" + advertencia clara.
 *
 * Es responsabilidad del dueño guardarla / pasarla por fuera. Si la
 * pierde antes de hacerlo, en este PR no hay forma de recuperarla
 * (queda como follow-up: botón "regenerar password" en la lista).
 */
import { useState } from 'react'
import styles from './PasswordRevealModal.module.css'

export default function PasswordRevealModal({ usuario, passwordPlano, onClose }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(passwordPlano)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Si el browser bloquea clipboard (HTTPS requerido), seleccionamos el
      // texto manualmente para que el dueño copie con Ctrl+C.
      alert('No se pudo copiar automáticamente. Seleccioná la password y copiala manualmente.')
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.icon}>✓</div>
        <h2 className={styles.title}>Usuario creado</h2>
        <p className={styles.who}>
          <strong>{usuario.nombre}</strong>
          <br />
          <span className={styles.email}>{usuario.email}</span>
        </p>

        <div className={styles.passSection}>
          <span className={styles.passLabel}>Contraseña generada</span>
          <div className={styles.passBox}>
            <span className={styles.passText}>{passwordPlano}</span>
            <button type="button" className={styles.btnCopy} onClick={copiar}>
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <p className={styles.warn}>
          ⚠ <strong>Esta contraseña no se vuelve a mostrar.</strong> Copiala
          ahora y pasásela al nuevo usuario por WhatsApp o en persona.
        </p>

        <button className={styles.btnPrimary} onClick={onClose}>
          Listo, ya la guardé
        </button>
      </div>
    </div>
  )
}
