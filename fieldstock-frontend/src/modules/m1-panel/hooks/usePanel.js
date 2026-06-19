// src/modules/m1-panel/hooks/usePanel.js
/**
 * Hook del M1 Panel IA — encapsula el estado del chat efimero.
 *
 * Estado mantenido en memoria del hook:
 *   - mensajes: array de turnos { role, content, traza? }
 *   - estado:   'idle' | 'enviando' | 'error'
 *   - error:    string | null
 *
 * `enviar(texto)` hace optimistic append del turno del user, llama al
 * service y agrega la respuesta cuando llega. Si falla, deja el mensaje
 * del user en la lista (no se borra) y setea `error` para que la UI lo
 * muestre con opcion de reintentar.
 *
 * `resetChat()` limpia todo — usado por el boton "Limpiar chat" del header.
 */
import { useState, useCallback } from 'react'
import { PanelService } from '../services/panel.service.js'

export function usePanel() {
  const [mensajes, setMensajes] = useState([])
  const [estado,   setEstado]   = useState('idle')
  const [error,    setError]    = useState(null)

  const enviar = useCallback(async (texto) => {
    const limpio = (texto || '').trim()
    if (!limpio || estado === 'enviando') return

    // Snapshot del historial ANTES de agregar el nuevo mensaje. El
    // backend espera el historial sin la pregunta actual — la pregunta
    // va en el campo `mensaje` aparte.
    const historialActual = mensajes.map(m => ({ role: m.role, content: m.content }))

    setMensajes(prev => [...prev, { role: 'user', content: limpio }])
    setEstado('enviando')
    setError(null)

    try {
      const { respuesta, traza } = await PanelService.chat(limpio, historialActual)
      setMensajes(prev => [...prev, { role: 'assistant', content: respuesta, traza }])
      setEstado('idle')
    } catch (err) {
      // El mensaje del user queda en la lista — el user puede reintentar
      // tipeando de nuevo o reformulando.
      setError(err.message || 'Algo salio mal. Reintentá en un momento.')
      setEstado('error')
    }
  }, [mensajes, estado])

  const resetChat = useCallback(() => {
    setMensajes([])
    setEstado('idle')
    setError(null)
  }, [])

  return {
    mensajes,
    estado,
    error,
    enviar,
    resetChat,
    pensando: estado === 'enviando',
  }
}
