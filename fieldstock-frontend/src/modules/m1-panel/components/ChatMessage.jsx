// src/modules/m1-panel/components/ChatMessage.jsx
/**
 * Burbuja de un turno del chat. Soporta:
 *   - role: 'user' o 'assistant' (avatar y alineacion distintos)
 *   - pensando: true muestra los tres puntitos animados
 *   - traza: array opcional de tools que el LLM uso para responder
 *           (toggle "Ver datos consultados")
 *
 * El texto se renderiza con `white-space: pre-wrap` — preserva saltos
 * de linea y bullets que mande el LLM sin parsear markdown.
 */
import { useState } from 'react'
import { LuSparkles, LuUser, LuChevronDown } from 'react-icons/lu'
import styles from './ChatMessage.module.css'

export default function ChatMessage({ mensaje }) {
  const [verTraza, setVerTraza] = useState(false)
  const esUser = mensaje.role === 'user'
  const hayTraza = !esUser && Array.isArray(mensaje.traza) && mensaje.traza.length > 0

  return (
    <div className={`${styles.row} ${esUser ? styles.user : styles.assistant}`}>
      <div className={styles.avatar} aria-hidden>
        {esUser ? <LuUser /> : <LuSparkles />}
      </div>
      <div className={styles.bubble}>
        {mensaje.pensando ? (
          <span className={styles.dots} aria-label="Pensando...">
            <span></span><span></span><span></span>
          </span>
        ) : (
          <div className={styles.content}>{mensaje.content}</div>
        )}

        {hayTraza && (
          <button
            type="button"
            className={`${styles.trazaToggle} ${verTraza ? styles.open : ''}`}
            onClick={() => setVerTraza(v => !v)}
          >
            <LuChevronDown /> {mensaje.traza.length} dato{mensaje.traza.length === 1 ? '' : 's'} consultado{mensaje.traza.length === 1 ? '' : 's'}
          </button>
        )}
        {hayTraza && verTraza && (
          <ul className={styles.trazaList}>
            {mensaje.traza.map((t, i) => (
              <li key={i} className={t.ok ? styles.trazaOk : styles.trazaErr}>
                <code>{t.tool}</code>
                {t.args && Object.keys(t.args).length > 0 && (
                  <span className={styles.trazaArgs}>
                    ({Object.entries(t.args).map(([k, v]) => `${k}: ${v}`).join(', ')})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
