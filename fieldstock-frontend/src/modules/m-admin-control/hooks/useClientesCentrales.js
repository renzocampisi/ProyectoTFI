// src/modules/m-admin-control/hooks/useClientesCentrales.js
import { useState, useEffect, useCallback } from 'react'
import { ClientesCentralesService } from '../services/clientes-centrales.service'

export function useClientesCentrales() {
  const [clientes, setClientes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setClientes(await ClientesCentralesService.getAll())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { clientes, loading, error, refetch: cargar }
}
