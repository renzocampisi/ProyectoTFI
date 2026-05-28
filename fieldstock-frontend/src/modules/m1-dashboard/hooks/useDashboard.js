// src/modules/m1-dashboard/hooks/useDashboard.js
/**
 * Hook que encapsula la carga del resumen para la home (Word #16).
 * Hace un solo fetch al endpoint agregado del backend.
 */
import { useState, useEffect, useCallback } from 'react'
import { DashboardService } from '../services/dashboard.service.js'

export function useDashboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const cargar = useCallback(() => {
    setLoading(true)
    setError(null)
    DashboardService.getResumen()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { data, loading, error, refrescar: cargar }
}
