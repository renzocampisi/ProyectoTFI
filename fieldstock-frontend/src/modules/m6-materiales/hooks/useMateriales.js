// src/modules/m6-materiales/hooks/useMateriales.js
/**
 * Hook del M6 — wrapper de MaterialesService.
 *
 * useMateriales({q}): hook de LISTA con búsqueda. Aplica debounce de 300ms
 *   cuando se escribe en `q` para evitar un request por cada tecla.
 *
 * Solo expone hook de lista — la página de detalle/edición lee usando
 * `MaterialesService.getById` directamente (decisión deliberada porque solo
 * lo usa un único componente).
 */
import { useState, useEffect, useCallback } from 'react'
import { MaterialesService } from '../services/materiales.service.js'

export function useMateriales({ q } = {}) {
  const [materiales, setMateriales] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await MaterialesService.getAll({ q })
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
