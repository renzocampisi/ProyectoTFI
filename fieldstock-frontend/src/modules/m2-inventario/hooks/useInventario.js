// src/modules/m2-inventario/hooks/useInventario.js
/**
 * Hooks del M2 — encapsulan el state + las llamadas a InventarioService.
 *
 * useInventario: hook para la PÁGINA LISTA.
 *   - Maneja el state de filtros (busqueda, estado, categoría) internamente.
 *   - Debounce de 300ms cuando se escribe en `busqueda` (reduce requests).
 *   - Calcula `conteos` por estado para los chips/badges de la UI.
 *
 * useHerramienta: hook para la PÁGINA DETALLE.
 *   - Carga la herramienta + su historial de movimientos en paralelo.
 *   - Devuelve null en `herramienta` mientras carga o si el id no existe.
 *
 * FIXME: hay duplicación estructural entre useInventario, useObras,
 * useRemitos, useMateriales (skeleton state/fetch/refetch). Refactor
 * candidato: hook genérico `useResource(serviceFn, deps)`.
 */
import { useState, useEffect, useCallback } from 'react'
import { InventarioService } from '../services/inventario.service.js'

export function useInventario() {
  const [herramientas,    setHerramientas]    = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [busqueda,        setBusqueda]        = useState('')
  const [filtroEstado,    setFiltroEstado]    = useState('TODOS')
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')

  const fetchHerramientas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await InventarioService.getAll({
        estado:       filtroEstado    !== 'TODOS' ? filtroEstado    : undefined,
        categoriaId:  filtroCategoria !== 'TODAS' ? filtroCategoria : undefined,
        q:            busqueda.trim() || undefined,
        incluirBajas: true,
      })
      setHerramientas(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [busqueda, filtroEstado, filtroCategoria])

  useEffect(() => {
    const timer = setTimeout(fetchHerramientas, busqueda ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchHerramientas, busqueda])

  const conteos = herramientas.reduce((acc, h) => {
    acc[h.estado] = (acc[h.estado] || 0) + 1
    return acc
  }, { TODOS: herramientas.length })

  return {
    herramientas,
    loading,
    error,
    conteos,
    busqueda,        setBusqueda,
    filtroEstado,    setFiltroEstado,
    filtroCategoria, setFiltroCategoria,
    refetch: fetchHerramientas,
  }
}

export function useHerramienta(id) {
  const [herramienta, setHerramienta] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [h, m] = await Promise.all([
        InventarioService.getById(id),
        InventarioService.getMovimientos(id),
      ])
      setHerramienta(h)
      setMovimientos(m)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { herramienta, movimientos, loading, error, refetch: fetch }
}
