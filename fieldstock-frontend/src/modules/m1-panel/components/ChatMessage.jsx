// src/modules/m1-panel/components/ChatMessage.jsx
/**
 * Burbuja de un turno del chat. Soporta:
 *   - role: 'user' o 'assistant' (avatar y alineacion distintos)
 *   - pensando: true muestra los tres puntitos animados
 *   - traza: array opcional de tools que el LLM uso para responder
 *           (toggle "Ver datos consultados")
 *   - accionPendiente + accionEstado: cuando el LLM propuso una accion de
 *     escritura (ej. sumar stock), se muestra una tarjeta con el resumen
 *     y botones Confirmar/Cancelar. Ninguna escritura se dispara sin el
 *     click explicito de "Confirmar" — onConfirmarAccion/onCancelarAccion
 *     los pasa el parent (usePanel.confirmarAccion/cancelarAccion).
 *
 * El texto se renderiza con `white-space: pre-wrap` — preserva saltos
 * de linea y bullets que mande el LLM sin parsear markdown.
 */
import { useState } from 'react'
import { LuSparkles, LuUser, LuChevronDown, LuCheck, LuX } from 'react-icons/lu'
import styles from './ChatMessage.module.css'

export default function ChatMessage({ mensaje, onConfirmarAccion, onCancelarAccion }) {
  const [verTraza, setVerTraza] = useState(false)
  // Deshabilita los botones apenas se clickean, sin esperar al re-render del
  // parent (usePanel) — la fuente de verdad real contra el doble-click sigue
  // siendo el guard atómico en confirmarAccion, esto es solo feedback visual
  // inmediato para que el segundo click ni siquiera intente disparar.
  const [disparando, setDisparando] = useState(false)
  const esUser = mensaje.role === 'user'
  const hayTraza = !esUser && Array.isArray(mensaje.traza) && mensaje.traza.length > 0
  const hayAccion = !esUser && Boolean(mensaje.accionPendiente)

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

        {hayAccion && mensaje.accionEstado === 'pendiente' && (
          <div className={styles.accionCard}>
            <p className={styles.accionAviso}>⚠ Esto va a modificar datos del sistema.</p>
            <div className={styles.accionBotones}>
              <button type="button" className={styles.btnAccionCancelar} disabled={disparando}
                onClick={() => { setDisparando(true); onCancelarAccion?.() }}>
                <LuX /> Cancelar
              </button>
              <button type="button" className={styles.btnAccionConfirmar} disabled={disparando}
                onClick={() => { setDisparando(true); onConfirmarAccion?.() }}>
                <LuCheck /> Confirmar
              </button>
            </div>
          </div>
        )}
        {hayAccion && mensaje.accionEstado === 'confirmando' && (
          <p className={styles.accionEstado}>Aplicando...</p>
        )}
        {hayAccion && mensaje.accionEstado === 'cancelada' && (
          <p className={styles.accionEstado}>Acción cancelada.</p>
        )}
        {hayAccion && mensaje.accionEstado === 'error' && (
          <div className={styles.accionCard}>
            <p className={styles.accionErrorMsg}>⚠ {mensaje.accionError}</p>
            <div className={styles.accionBotones}>
              <button type="button" className={styles.btnAccionCancelar}
                onClick={() => onCancelarAccion?.()}>
                <LuX /> Cancelar
              </button>
              <button type="button" className={styles.btnAccionConfirmar}
                onClick={() => onConfirmarAccion?.()}>
                <LuCheck /> Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
