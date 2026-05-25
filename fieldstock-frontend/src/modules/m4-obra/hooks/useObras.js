// src/modules/m4-obra/hooks/useObras.js
/**
 * Hooks del M4 — wrappers de ObrasService con state de carga/error.
 *
 * useObras({estado, q}): hook de LISTA. Los filtros vienen como props del
 *   caller (a diferencia de useInventario, que maneja state propio).
 * useObra(id): hook de DETALLE. Devuelve null si id es falsy.
 */
import { useState, useEffect, useCallback } from 'react'
import { ObrasService } from '../services/obras.service.js'

export function useObras({ estado, q } = {}) {
  const [obras,   setObras]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await ObrasService.getAll({ estado, q })
      setObras(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [estado, q])

  useEffect(() => { cargar() }, [cargar])

  return { obras, loading, error, refetch: cargar }
}

export function useObra(id) {
  const [obra,    setObra]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await ObrasService.getById(id)
      setObra(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  return { obra, loading, error, refetch: cargar }
}
