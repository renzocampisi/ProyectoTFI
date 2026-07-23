// src/modules/m-admin-control/hooks/useDispositivos.js
import { useState, useEffect, useCallback } from 'react'
import { DispositivosService } from '../services/dispositivos.service'

export function useDispositivos() {
  const [dispositivos, setDispositivos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setDispositivos(await DispositivosService.getAll())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { dispositivos, loading, error, refetch: cargar }
}
