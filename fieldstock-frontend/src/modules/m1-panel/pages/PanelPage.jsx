// src/modules/m1-panel/pages/PanelPage.jsx
/**
 * Pagina principal del M1 Panel IA — chat con el asistente.
 *
 * Layout:
 *   - Header sticky con titulo y boton "Limpiar chat".
 *   - Lista de mensajes scrollable (auto-scroll al fondo).
 *   - Composer sticky abajo.
 *
 * Cuando no hay mensajes, mostramos un estado vacio con sugerencias
 * clickeables que ayudan al user a arrancar.
 */
import { useEffect, useRef } from 'react'
import { LuSparkles, LuTrash2 } from 'react-icons/lu'
import { usePanel } from '../hooks/usePanel'
import ChatMessage from '../components/ChatMessage'
import Composer from '../components/Composer'
import styles from './PanelPage.module.css'

const SUGERENCIAS = [
  '¿Qué obras están activas?',
  '¿Qué materiales se están por quedar sin stock?',
  '¿Qué herramientas están en mantenimiento?',
  '¿Cuántos remitos hay en borrador?',
]

export default function PanelPage() {
  const { mensajes, pensando, error, enviar, resetChat } = usePanel()
  const fondoRef = useRef(null)

  // Scroll automatico al fondo en cada turno nuevo (incluido el "pensando").
  useEffect(() => {
    fondoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, pensando])

  const vacio = mensajes.length === 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <LuSparkles className={styles.titleIcon} />
          <div>
            <h1 className={styles.title}>Panel IA</h1>
            <p className={styles.subtitle}>
              Preguntale al sistema en lenguaje natural sobre tus obras, herramientas y materiales.
            </p>
          </div>
        </div>
        {!vacio && (
          <button className={styles.btnReset} onClick={resetChat} title="Limpiar chat">
            <LuTrash2 /> Limpiar
          </button>
        )}
      </header>

      <div className={styles.chatArea}>
        {vacio ? (
          <div className={styles.vacio}>
            <h2 className={styles.vacioTitle}>¿Sobre qué querés preguntar?</h2>
            <p className={styles.vacioHint}>Probá con una de estas sugerencias:</p>
            <div className={styles.sugerencias}>
              {SUGERENCIAS.map(s => (
                <button key={s} className={styles.sugerencia} onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.mensajes}>
            {mensajes.map((m, i) => (
              <ChatMessage key={i} mensaje={m} />
            ))}
            {pensando && <ChatMessage mensaje={{ role: 'assistant', content: '', pensando: true }} />}
            {error && (
              <div className={styles.errorBanner}>
                <strong>Algo salió mal:</strong> {error}
              </div>
            )}
            <div ref={fondoRef} />
          </div>
        )}
      </div>

      <div className={styles.composerWrap}>
        <Composer onSubmit={enviar} disabled={pensando} />
      </div>
    </div>
  )
}
