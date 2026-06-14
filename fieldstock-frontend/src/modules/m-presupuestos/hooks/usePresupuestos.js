// src/modules/m-presupuestos/hooks/usePresupuestos.js
/**
 * Hooks de Presupuestos — wrappers de PresupuestosService con state.
 *
 * - usePresupuestos({ obraId, estado }): lista filtrable.
 * - usePresupuesto(id): detalle con insumos + costos.
 *
 * Las mutaciones (aprobar, rechazar, addInsumo, etc.) viven en los
 * componentes y disparan refetch() acá.
 */
import { useState, useEffect, useCallback } from 'react'
import { PresupuestosService } from '../services/presupuestos.service.js'

export function usePresupuestos({ obraId, estado } = {}) {
  const [presupuestos, setPresupuestos] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await PresupuestosService.getAll({ obraId, estado })
      setPresupuestos(Array.isArray(data) ? data : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [obraId, estado])

  useEffect(() => { cargar() }, [cargar])
  return { presupuestos, loading, error, refetch: cargar }
}

export function usePresupuesto(id) {
  const [presupuesto, setPresupuesto] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await PresupuestosService.getById(id)
      setPresupuesto(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  return { presupuesto, loading, error, refetch: cargar }
}
