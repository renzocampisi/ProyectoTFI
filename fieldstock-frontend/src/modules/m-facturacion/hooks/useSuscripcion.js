// src/modules/m-facturacion/hooks/useSuscripcion.js
/**
 * Estado de la suscripción de esta instancia. `estadoEfectivo` es el que
 * hay que mirar para gating (PRUEBA/ACTIVA/VENCIDA/BLOQUEADA) — lo calcula
 * el backend a partir de fechas, no depende de un cron.
 */
import { useState, useEffect, useCallback } from 'react'
import { FacturacionService } from '../services/facturacion.service'

export function useSuscripcion() {
  const [suscripcion, setSuscripcion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setSuscripcion(await FacturacionService.getSuscripcion())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { suscripcion, loading, error, refetch: cargar }
}
