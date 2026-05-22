// src/modules/m5-remito/hooks/useRemitos.js
import { useState, useEffect, useCallback } from 'react'
import { RemitosService } from '../services/remitos.service.js'

export function useRemitos({ estado, q } = {}) {
  const [remitos,  setRemitos]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await RemitosService.getAll({ estado, q })
      setRemitos(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [estado, q])

  useEffect(() => { fetch() }, [fetch])
  return { remitos, loading, error, refetch: fetch }
}

export function useRemito(id) {
  const [remito,  setRemito]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await RemitosService.getById(id)
      setRemito(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetch() }, [fetch])
  return { remito, loading, error, refetch: fetch }
}
