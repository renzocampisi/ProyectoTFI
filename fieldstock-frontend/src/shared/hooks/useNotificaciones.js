// src/shared/hooks/useNotificaciones.js
/**
 * Hook global de notificaciones in-app.
 *
 * Carga las notificaciones del backend y hace polling cada 30s para detectar
 * nuevas. Pausa el polling cuando la pestaña no está activa (Page Visibility
 * API) — el user no necesita refrescos en background, y ahorra requests.
 *
 * Devuelve: { notifs, noLeidas, loading, error, refetch,
 *             marcarLeida, marcarTodasLeidas }
 *
 *   - `notifs`: array completo (últimas 50, ordenadas DESC por created_at)
 *   - `noLeidas`: count de notifs con leida=false (para el badge)
 *   - `marcarLeida(id)`: optimistic update + PATCH al backend
 *   - `marcarTodasLeidas()`: optimistic + PATCH al backend
 *
 * El componente que use este hook se monta una sola vez (típicamente en
 * <AppLayout>) y comparte el estado vía props o context si hace falta —
 * por ahora el único consumer es <NotificacionesBell> así que va inline.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { NotificacionesService } from '@shared/services/notificaciones.service'

const POLL_INTERVAL_MS = 30_000

export function useNotificaciones() {
  const [notifs,  setNotifs]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await NotificacionesService.getAll()
      setNotifs(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      // No alarmar al user por un timeout del polling — mantenemos el último
      // estado válido. Solo el primer fetch puede mostrar error visible.
      console.warn('[useNotificaciones] fetch failed:', err?.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Boot + polling con pausa por visibilidad.
  const pollingRef = useRef(null)
  useEffect(() => {
    fetchNotifs()
    const start = () => {
      if (pollingRef.current) return
      pollingRef.current = setInterval(fetchNotifs, POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    start()
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        fetchNotifs() // refresh inmediato al volver a la tab
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchNotifs])

  // Optimistic updates: marcamos en local primero, después persistimos.
  // Si falla la persistencia, refetch para resincronizar.
  const marcarLeida = useCallback(async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    try { await NotificacionesService.marcarLeida(id) }
    catch (err) {
      console.warn('[useNotificaciones] marcarLeida failed:', err?.message)
      fetchNotifs()
    }
  }, [fetchNotifs])

  const marcarTodasLeidas = useCallback(async () => {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    try { await NotificacionesService.marcarTodasLeidas() }
    catch (err) {
      console.warn('[useNotificaciones] marcarTodasLeidas failed:', err?.message)
      fetchNotifs()
    }
  }, [fetchNotifs])

  const noLeidas = notifs.filter(n => !n.leida).length

  return { notifs, noLeidas, loading, error, refetch: fetchNotifs, marcarLeida, marcarTodasLeidas }
}
