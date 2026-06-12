// src/modules/m9-usuarios/components/PasswordRevealModal.jsx
/**
 * Modal genérico de revelación de password. Se usa después de:
 *   - crear un usuario (titulo "Usuario creado", passLabel "Contraseña generada")
 *   - resetear la password de un usuario (titulo "Contraseña reseteada", passLabel "Nueva contraseña")
 *
 * Muestra la password UNA SOLA VEZ con botón "Copiar al portapapeles" +
 * advertencia clara. Es responsabilidad del dueño guardarla / pasarla por fuera.
 *
 * Props:
 *   usuario        { nombre, email } — quien es
 *   passwordPlano  string             — la pass a mostrar
 *   onClose        fn                  — cerrar
 *   titulo         opcional            — default "Usuario creado"
 *   passLabel      opcional            — default "Contraseña generada"
 */
import { useState } from 'react'
import styles from './PasswordRevealModal.module.css'

export default function PasswordRevealModal({
  usuario,
  passwordPlano,
  onClose,
  titulo    = 'Usuario creado',
  passLabel = 'Contraseña generada',
}) {
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
        <h2 className={styles.title}>{titulo}</h2>
        <p className={styles.who}>
          <strong>{usuario.nombre}</strong>
          <br />
          <span className={styles.email}>{usuario.email}</span>
        </p>

        <div className={styles.passSection}>
          <span className={styles.passLabel}>{passLabel}</span>
          <div className={styles.passBox}>
            <span className={styles.passText}>{passwordPlano}</span>
            <button type="button" className={styles.btnCopy} onClick={copiar}>
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <p className={styles.warn}>
          ⚠ <strong>Esta contraseña no se vuelve a mostrar.</strong> Copiala
          ahora y pasásela al usuario por WhatsApp o en persona.
        </p>

        <button className={styles.btnPrimary} onClick={onClose}>
          Listo, ya la guardé
        </button>
      </div>
    </div>
  )
}
