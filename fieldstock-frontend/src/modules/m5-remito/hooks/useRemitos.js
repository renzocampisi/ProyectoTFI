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
 */
import { useState, useEffect, useCallback } from 'react'
import { RemitosService } from '../services/remitos.service.js'

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

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await RemitosService.getById(id)
      setRemito(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  return { remito, loading, error, refetch: cargar }
}
