// src/modules/m2-inventario/hooks/useInventario.js
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
