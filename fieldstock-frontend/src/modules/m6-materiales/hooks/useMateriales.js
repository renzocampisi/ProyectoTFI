// src/modules/m6-materiales/hooks/useMateriales.js
import { useState, useEffect, useCallback } from 'react'
import { MateriasService } from '../services/materiales.service.js'

export function useMateriales({ q } = {}) {
  const [materiales, setMateriales] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await MateriasService.getAll({ q })
      setMateriales(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [q])

  useEffect(() => {
    const timer = setTimeout(fetch, q ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetch, q])

  return { materiales, loading, error, refetch: fetch }
}
