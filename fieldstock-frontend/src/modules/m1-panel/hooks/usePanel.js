// src/modules/m1-panel/hooks/usePanel.js
/**
 * Hook del M1 Panel IA — encapsula el estado del chat efimero.
 *
 * Estado mantenido en memoria del hook:
 *   - mensajes: array de turnos { role, content, traza?, accionPendiente?, accionEstado? }
 *   - estado:   'idle' | 'enviando' | 'error'
 *   - error:    string | null
 *
 * `enviar(texto)` hace optimistic append del turno del user, llama al
 * service y agrega la respuesta cuando llega. Si falla, deja el mensaje
 * del user en la lista (no se borra) y setea `error` para que la UI lo
 * muestre con opcion de reintentar.
 *
 * Cuando la respuesta trae `accionPendiente` (el LLM propuso una accion de
 * escritura, ej. sumar stock), el turno del asistente queda con
 * `accionEstado: 'pendiente'` — la UI muestra una tarjeta de confirmacion.
 * `confirmarAccion(i)` / `cancelarAccion(i)` resuelven ese turno puntual;
 * ninguna escritura se dispara sin el click explicito de confirmar.
 *
 * `resetChat()` limpia todo — usado por el boton "Limpiar chat" del header.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { PanelService } from '../services/panel.service.js'

export function usePanel() {
  const [mensajes, setMensajes] = useState([])
  const [estado,   setEstado]   = useState('idle')
  const [error,    setError]    = useState(null)

  // Espejo síncrono de `mensajes`. El updater que le pasamos a setState NO
  // corre en el momento en que se llama (React lo procesa en su propio ciclo,
  // no como efecto secundario inmediato del call) — así que no sirve para
  // leer "¿ya está confirmando?" en la misma función que lo dispara. Este ref
  // sí se actualiza en el instante, por eso es la fuente de verdad del guard
  // anti-doble-click en confirmarAccion.
  const mensajesRef = useRef(mensajes)
  useEffect(() => { mensajesRef.current = mensajes }, [mensajes])

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
      const { respuesta, traza, accionPendiente } = await PanelService.chat(limpio, historialActual)
      setMensajes(prev => [...prev, {
        role: 'assistant',
        content: respuesta,
        traza,
        accionPendiente,
        accionEstado: accionPendiente ? 'pendiente' : undefined,
      }])
      setEstado('idle')
    } catch (err) {
      // El mensaje del user queda en la lista — el user puede reintentar
      // tipeando de nuevo o reformulando.
      setError(err.message || 'Algo salio mal. Reintentá en un momento.')
      setEstado('error')
    }
  }, [mensajes, estado])

  // Marca el turno `index` como confirmado, pega contra el backend para
  // ejecutar la escritura real, y agrega el resultado como turno nuevo.
  //
  // El check-and-set "¿está pendiente? → marcarlo confirmando" se hace contra
  // `mensajesRef` y se escribe ahí de inmediato (sincrónico), ANTES de llamar
  // a setMensajes. Si se hiciera solo con el updater de setState, dos clicks
  // seguidos en el mismo tick verían ambos accionEstado === 'pendiente' (el
  // updater no corre en el momento de la llamada, sino en el ciclo propio de
  // React) y dispararían la escritura dos veces.
  const confirmarAccion = useCallback(async (index) => {
    const turno = mensajesRef.current[index]
    if (!turno?.accionPendiente || turno.accionEstado !== 'pendiente') return

    const conConfirmando = mensajesRef.current.map((m, i) =>
      i === index ? { ...m, accionEstado: 'confirmando' } : m)
    mensajesRef.current = conConfirmando
    setMensajes(conConfirmando)

    try {
      const { resumen } = await PanelService.ejecutarAccion(
        turno.accionPendiente.tool,
        turno.accionPendiente.args,
      )
      setMensajes(prev => {
        const next = prev.map((m, i) => i === index ? { ...m, accionEstado: 'hecha' } : m)
        return [...next, { role: 'assistant', content: resumen }]
      })
    } catch (err) {
      setMensajes(prev => prev.map((m, i) => i === index
        ? { ...m, accionEstado: 'error', accionError: err.message || 'No se pudo ejecutar la acción.' }
        : m))
    }
  }, [])

  const cancelarAccion = useCallback((index) => {
    const next = mensajesRef.current.map((m, i) => i === index ? { ...m, accionEstado: 'cancelada' } : m)
    mensajesRef.current = next
    setMensajes(next)
  }, [])

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
    confirmarAccion,
    cancelarAccion,
    pensando: estado === 'enviando',
  }
}
