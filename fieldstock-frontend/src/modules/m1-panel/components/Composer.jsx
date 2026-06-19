// src/modules/m1-panel/components/Composer.jsx
/**
 * Caja de entrada del chat. Textarea auto-grow + boton enviar.
 *
 *   - Enter envia, Shift+Enter agrega salto de linea.
 *   - Mientras esta `disabled` (pensando), no se puede enviar pero el
 *     usuario puede seguir tipeando el siguiente mensaje.
 *   - El textarea se resetea apenas se hace submit (no esperamos respuesta).
 */
import { useState, useRef, useEffect } from 'react'
import { LuSend } from 'react-icons/lu'
import styles from './Composer.module.css'

const MAX_HEIGHT = 160

export default function Composer({ onSubmit, disabled }) {
  const [texto, setTexto] = useState('')
  const taRef = useRef(null)

  // Auto-resize: ajusta la altura al contenido sin pasarse de MAX_HEIGHT.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, MAX_HEIGHT) + 'px'
  }, [texto])

  const submit = () => {
    const t = texto.trim()
    if (!t || disabled) return
    onSubmit(t)
    setTexto('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={e => { e.preventDefault(); submit() }}
    >
      <textarea
        ref={taRef}
        className={styles.textarea}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={handleKey}
        placeholder={disabled ? 'Esperando respuesta...' : 'Preguntá lo que quieras del sistema...'}
        rows={1}
      />
      <button
        type="submit"
        className={styles.btnSend}
        disabled={!texto.trim() || disabled}
        title="Enviar (Enter)"
      >
        <LuSend />
      </button>
    </form>
  )
}
