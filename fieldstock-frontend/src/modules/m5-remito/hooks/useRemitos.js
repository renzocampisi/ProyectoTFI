// src/modules/m5-remito/hooks/useRemitos.js
/**
 * Hooks del M5 — wrappers de RemitosService con state de carga/error.
 *
 * useRemitos({estado, q}): hook de LISTA. Filtros como props.
 * useRemito(id): hook de DETALLE — incluye items de herramientas y
 *   materiales (el backend los precarga vía vistas).
 *
 * Las mutaciones (avanzar, eliminar, addItem, etc.) NO viven en estos
 * hooks — se llaman directo a `RemitosService.x()` desde el componente
 * y luego se hace `refetch()` para actualizar la vista.
 *
 * useRemito además hace POLLING liviano cuando el remito está "vivo"
 * (CONFIRMADO/EN_TRANSITO/EN_OBRA/EN_RETORNO/EN_TRANSITO_RETORNO):
 * re-fetchea cada 3s mientras el tab esté visible, así si el responsable
 * confirma el QR desde el celular, la PC ve el cambio sin refrescar.
 * Se pausa cuando el tab está oculto (Page Visibility API) y se corta
 * automáticamente cuando el remito pasa a BORRADOR o CERRADO.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { RemitosService } from '../services/remitos.service.js'

// Estados "vivos" donde tiene sentido polear: cualquier transición puede
// venir desde el celular (confirmar escaneo, reportar problema, etc.).
const ESTADOS_LIVE = new Set([
  'CONFIRMADO',
  'EN_TRANSITO',
  'EN_OBRA',
  'EN_RETORNO',
  'EN_TRANSITO_RETORNO',
])
const POLL_INTERVAL_MS = 3000

export function useRemitos({ estado, q } = {}) {
  const [remitos,  setRemitos]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await RemitosService.getAll({ estado, q })
      setRemitos(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [estado, q])

  useEffect(() => { cargar() }, [cargar])
  return { remitos, loading, error, refetch: cargar }
}

export function useRemito(id) {
  const [remito,  setRemito]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Ref para que el polling no marque "loading" en cada tick (sería
  // visualmente molesto). Solo el primer fetch + refetch manual lo hacen.
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!id) return
    if (!silencioso) { setLoading(true); setError(null) }
    try {
      const data = await RemitosService.getById(id)
      setRemito(data)
    } catch (err) {
      // En polling silencioso ignoramos errores transitorios (la próxima
      // tick lo va a reintentar). Solo propagamos si es la carga inicial.
      if (!silencioso) setError(err.message)
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  // ── Polling para sync con confirmaciones desde celular ──────────
  // Mantenemos el estado actual en una ref para que el setInterval no
  // tenga que recrearse en cada cambio de remito.
  const estadoActualRef = useRef(null)
  useEffect(() => { estadoActualRef.current = remito?.estado }, [remito?.estado])

  useEffect(() => {
    if (!id) return

    let timer = null

    const start = () => {
      if (timer) return
      timer = setInterval(() => {
        // Solo polear si el remito está en un estado donde podría cambiar
        // por una acción externa (escaneo QR desde celular). Si está en
        // BORRADOR (no hay QR todavía) o CERRADO (terminal), no tiene sentido.
        if (estadoActualRef.current && ESTADOS_LIVE.has(estadoActualRef.current)) {
          cargar({ silencioso: true })
        }
      }, POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    // Page Visibility: pausamos cuando el tab no se ve para no consumir
    // recursos. Cuando vuelve a primer plano, además forzamos una carga
    // inmediata para sentir el cambio sin esperar al próximo tick.
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        cargar({ silencioso: true })
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [id, cargar])

  return { remito, loading, error, refetch: cargar }
}
